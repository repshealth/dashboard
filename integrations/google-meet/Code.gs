/**
 * REPS Scaling OS: Google Meet transcripts into the CRM.
 *
 * Runs in a REPS team member's Google account. Every 15 minutes it looks in the
 * "Meet Recordings" Drive folder (where Google Meet saves "Notes by Gemini" and
 * transcripts), and sends any new doc to the dashboard, with the guest list from the
 * matching Calendar event so the call can be matched to the right client.
 *
 * Setup (5 minutes, once per team member who hosts client calls):
 *   1. Go to script.google.com > New project, paste this file in.
 *   2. Fill in DASHBOARD_URL and SECRET below (SECRET = MEETINGS_SECRET in Vercel).
 *   3. Run "setup" once and accept the permissions (Drive read, Calendar read, external requests).
 *   That's it. Run "sync" any time to send new docs straight away.
 *
 * In Google Meet, turn on "Take notes with Gemini" and/or transcripts for client calls
 * (or set them to start automatically in Calendar).
 */
const DASHBOARD_URL = 'https://YOUR-DASHBOARD.vercel.app';
const SECRET = 'PASTE MEETINGS_SECRET HERE';
const FOLDER_NAME = 'Meet Recordings';
const FIRST_RUN_DAYS = 60; // how far back the first run looks

function setup() {
  ScriptApp.getProjectTriggers().forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sync').timeBased().everyMinutes(15).create();
  sync();
}

function sync() {
  const props = PropertiesService.getScriptProperties();
  const done = JSON.parse(props.getProperty('done') || '[]');
  const since = Date.now() - FIRST_RUN_DAYS * 864e5;
  const folders = DriveApp.getFoldersByName(FOLDER_NAME);
  while (folders.hasNext()) {
    const files = folders.next().getFilesByType(MimeType.GOOGLE_DOCS);
    while (files.hasNext()) {
      const f = files.next();
      const id = f.getId();
      if (done.indexOf(id) >= 0 || f.getDateCreated().getTime() < since) continue;
      if (!/notes by gemini|transcript/i.test(f.getName())) continue;
      // Gemini keeps writing for a few minutes after the call ends.
      if (Date.now() - f.getLastUpdated().getTime() < 10 * 60e3) continue;
      try {
        const event = findEvent_(f.getName(), f.getDateCreated());
        const res = UrlFetchApp.fetch(DASHBOARD_URL.replace(/\/$/, '') + '/api/meetings/ingest', {
          method: 'post',
          contentType: 'application/json',
          headers: { 'x-reps-secret': SECRET },
          muteHttpExceptions: true,
          payload: JSON.stringify({
            docId: id,
            title: f.getName(),
            url: f.getUrl(),
            text: docText_(id),
            attendees: event ? event.getGuestList(true).map((g) => g.getEmail()) : [],
            startedAt: event ? event.getStartTime().toISOString() : null,
            endedAt: event ? event.getEndTime().toISOString() : null,
          }),
        });
        if (res.getResponseCode() < 300) done.push(id);
        else console.warn(f.getName() + ': ' + res.getResponseCode() + ' ' + res.getContentText());
      } catch (e) {
        console.warn(f.getName() + ': ' + e);
      }
    }
  }
  props.setProperty('done', JSON.stringify(done.slice(-3000)));
}

/** All the doc's text, including every tab (newer Gemini notes keep the transcript in a tab). */
function docText_(id) {
  const doc = DocumentApp.openById(id);
  if (!doc.getTabs) return doc.getBody().getText();
  const out = [];
  const walk = (tabs) => tabs.forEach((t) => {
    out.push('## ' + t.getTitle());
    out.push(t.asDocumentTab().getBody().getText());
    walk(t.getChildTabs());
  });
  walk(doc.getTabs());
  return out.join('\n\n');
}

/** The Calendar event the doc came from: same title, ending shortly before the doc was made. */
function findEvent_(docName, created) {
  const title = docName.replace(/\s*[-–]\s*\d{4}\/\d{2}\/\d{2}.*$/, '').trim().toLowerCase();
  const events = CalendarApp.getDefaultCalendar().getEvents(new Date(created.getTime() - 8 * 36e5), new Date(created.getTime() + 36e5));
  for (let i = events.length - 1; i >= 0; i--) if (events[i].getTitle().trim().toLowerCase() === title) return events[i];
  return null;
}
