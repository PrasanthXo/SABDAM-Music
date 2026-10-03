# SABDHAM top-bar notification route

SABDHAM 1.2.5 adds remote messages to the Home toolbar notification bell.

## Public app route

`GET /api/toolbar-notifications`

Returns active, non-expired messages for the Android notification bell.

## Send a message

`POST /api/admin/toolbar-notifications`

Required header:

`X-SABDHAM-ADMIN-KEY: <server admin key>`

JSON body:

```json
{
  "title": "SABDHAM News",
  "message": "Your message to users.",
  "type": "info",
  "ttlHours": 168
}
```

Allowed types: `info`, `update`, `warning`, `success`.

`ttlHours: 0` means no automatic expiry.

The server must have `SABDHAM_NOTIFICATION_ADMIN_KEY` configured in Render. The secret is never shipped in the Android app.

## Remove a message

`DELETE /api/admin/toolbar-notifications/:id`

Use the same admin-key header.

## Android behavior

- The app fetches active messages when Home starts and refreshes every two minutes while it is running.
- New remote messages increase the top-bar bell badge.
- Opening the bell marks the fetched remote messages as read on that device.
- Messages remain visible in the bell while they are active on the server.
- Optional app updates remain in the bell.
- Major/required app updates remain on the non-dismissible force-update screen.
