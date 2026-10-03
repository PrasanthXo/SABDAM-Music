package com.morningmusic.app.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

internal val SABDHAM_ABOUT_TEXT = """
SABDHAM
Music for every moment

Version 1.2.0 • Android package: com.sabdham.music
Developed and published by Santh Creatives.

Santh Creatives is the developer/publisher name used for this independent personal software project. It is not represented as a registered company, corporation, record label or music licensing organisation.

SABDHAM is an independent music discovery, playback, playlist and personal music-library application.

Version 1.2.0 includes:
• personalized and larger Home catalogues;
• improved Tamil, Sinhala and English music search;
• separate Songs and Playlists search;
• public playlist discovery and import support;
• playlist Play All, Add to Library and Add to Queue actions;
• queue reordering and stronger playback fallbacks;
• native volume and audio-output routing controls;
• verified artwork matching and safer default artwork fallbacks; and
• small-screen and bottom-navigation layout protection.

SABDHAM may display or reference music information, metadata, artwork, artist information, streaming references and other material supplied by third-party services or publicly accessible internet sources.

Depending on the requested feature, SABDHAM may communicate with services including Google/Firebase, Spotify, YouTube, Audius, Apple/iTunes, MusicBrainz, Cover Art Archive, Last.fm and The Movie Database (TMDB), subject to availability and each provider's terms.

This product uses the TMDB API but is not endorsed or certified by TMDB.

SABDHAM and Santh Creatives do not claim ownership of third-party musical works, recordings, lyrics, artwork, photographs, trademarks, videos, artist names or other protected intellectual property.

All third-party rights remain with their respective owners, artists, labels, publishers, licensors, photographers, platforms and other rights holders.

Public accessibility does not mean that material is copyright-free, in the public domain or licensed for unrestricted redistribution.

Rights holders may use Contact Support to request review, correction, restriction or removal of material.
""".trimIndent()

internal val SABDHAM_TERMS_TEXT = """
SABDHAM TERMS & CONDITIONS

Developer / Publisher: Santh Creatives
Application: SABDHAM
Version: 1.2.0
Last updated: 3 October 2026

1. ACCEPTANCE

By accessing, installing or using SABDHAM, you agree to these Terms & Conditions. If you do not agree, discontinue use of the application.

2. INDEPENDENT PROJECT

SABDHAM is an independently developed personal software project.

Santh Creatives is a developer/publisher name and is not represented as a registered company, corporation, record label or music licensing organisation.

3. SERVICE PURPOSE

SABDHAM may provide music discovery, search, playback, personalized catalogues, playlists, public-playlist discovery, playlist import, liked songs, queue management, audio-output controls, library management, user accounts, preferences, metadata, artwork and related functionality.

Features may be changed, limited, updated or removed when necessary.

4. THIRD-PARTY CONTENT AND SERVICES

SABDHAM does not claim ownership of third-party songs, recordings, compositions, lyrics, artwork, photographs, videos, artist identities, trademarks, metadata or other protected material.

SABDHAM may depend on third-party authentication, hosting, database, search, playlist, metadata, artwork, media and streaming-related services, including services such as Google/Firebase, Spotify, YouTube, Audius, Apple/iTunes, MusicBrainz, Cover Art Archive, Last.fm and TMDB.

Those services are governed by their own terms and policies. Their availability, accuracy and continued operation are not controlled by SABDHAM.

5. PUBLIC INTERNET MATERIAL

Some information, playlist references or media references may originate from publicly accessible internet sources.

Public availability must not be interpreted as proof that material is copyright-free or that SABDHAM or its users have permission to reproduce, redistribute or commercially exploit it.

6. NO CONTENT LICENCE GRANTED

Use of SABDHAM does not grant users ownership of, or a copyright licence in, third-party content.

Users remain responsible for complying with copyright, platform rules and applicable law.

7. SEARCH, PLAYLISTS AND IMPORTS

Search and playlist discovery may combine results from multiple providers.

Imported or discovered playlists may contain references to third-party content. Availability can change, items can be removed and provider APIs can change without notice.

SABDHAM does not guarantee that every playlist item will remain playable or available.

8. PLAYBACK AND FALLBACK SOURCES

SABDHAM may use more than one playback source or resolver to improve playback reliability.

A fallback source may be used only when earlier sources are unavailable or fail.

No guarantee is made that a particular track, source, bitrate or playback route will always be available.

9. AUDIO OUTPUT ROUTING

Where supported by Android and the device, SABDHAM may show available audio outputs and allow switching between phone, Bluetooth or other system-supported routes.

Actual route availability and multi-device behavior depend on the device, Android version, connected hardware and system capabilities.

10. PERSONALIZATION

SABDHAM may use listening activity, likes, recent playback and related preferences to personalize catalogues and recommendations.

Personalization is intended to improve discovery and does not guarantee that every suggestion will match user preferences.

11. USER RESPONSIBILITY

Users must not knowingly use SABDHAM to:
• infringe intellectual-property rights;
• distribute unauthorized protected material;
• bypass security systems or access controls;
• gain unauthorized access;
• abuse accounts or services;
• impersonate others;
• interfere with application infrastructure; or
• violate applicable law.

12. USER ACCOUNTS

Users are responsible for protecting access to their devices and authentication methods and for promptly reporting suspected unauthorized account use.

13. LIBRARY AND SYNCHRONIZATION DATA

SABDHAM may store and synchronize playlists, likes, profile information, settings, recently played information, playback-interest information and related account data.

Synchronization is a convenience feature and must not be considered a guaranteed permanent backup.

14. UPDATES

SABDHAM may provide optional or required application updates for security, compatibility, reliability, legal, provider or service changes.

Older versions may lose access to features when they are no longer compatible with current services.

15. SERVICE MODIFICATION

SABDHAM may modify, suspend or discontinue features for technical, legal, copyright, security, maintenance, operational or policy reasons.

16. AS-IS SERVICE

To the maximum extent permitted by law, SABDHAM is provided on an "as is" and "as available" basis.

No guarantee is made that operation will always be uninterrupted, error-free or compatible with every device, network, provider or media source.

17. THIRD-PARTY INFORMATION

External metadata, artwork, links, playlist information and media information may occasionally be inaccurate, incomplete, unavailable or outdated.

18. NETWORK AND SERVICE OUTAGES

Santh Creatives is not responsible for outages caused by internet connectivity, hosting providers, third-party APIs, authentication systems, external platforms or circumstances outside reasonable control.

19. LIMITATION OF LIABILITY

To the maximum extent permitted by applicable law, Santh Creatives will not be responsible for indirect, incidental, consequential or special losses caused by use or inability to use SABDHAM, third-party service failures, synchronization failures, unavailable content, routing problems or network problems.

Nothing in these Terms excludes rights or liabilities that cannot legally be excluded.

20. COPYRIGHT AND RIGHTS-HOLDER REQUESTS

SABDHAM respects intellectual-property rights.

Copyright owners and authorized representatives may request review, correction, restriction or removal of disputed material through Contact Support.

A request should include:
• identification of the protected work;
• identification of the disputed material;
• evidence of ownership or authority;
• the requested action; and
• contact details for follow-up.

SABDHAM may restrict or remove disputed material while a claim is reviewed.

21. NO WARRANTY OF CONTENT RIGHTS

SABDHAM does not guarantee that every third-party source has granted SABDHAM redistribution or streaming rights.

A rights holder may request review, restriction or removal at any time.

22. ACCOUNT RESTRICTIONS

Accounts may be restricted or terminated where reasonably necessary to address abuse, fraud, security threats, legal obligations or serious violations of these Terms.

23. ACCOUNT DELETION

Where account deletion is available, deletion may permanently remove profile details, playlists, likes, settings and associated account information, subject to limited retention required by law, security or fraud-prevention needs.

24. USER DATA LOSS

Users should not rely on SABDHAM as their sole permanent archive for playlists or other important information.

25. SECURITY

Users must not attempt to probe, attack, disrupt or circumvent SABDHAM security or infrastructure.

26. CHANGES TO TERMS

These Terms may be updated when SABDHAM changes its functionality, infrastructure, legal requirements or third-party services. The updated date will be changed when material revisions are published.

27. SEVERABILITY

If any provision is found unenforceable, the remaining provisions should continue to apply to the extent permitted by law.

28. MANDATORY RIGHTS

Nothing in these Terms is intended to waive mandatory consumer, privacy or statutory rights that cannot legally be waived.

29. CONTACT

Support, copyright, privacy, legal and removal requests may be submitted through the Contact Support function inside SABDHAM.
""".trimIndent()

internal val SABDHAM_PRIVACY_TEXT = """
SABDHAM PRIVACY POLICY

Developer / Publisher: Santh Creatives
Application: SABDHAM
Version: 1.2.0
Last updated: 3 October 2026

1. PURPOSE

This Privacy Policy explains how SABDHAM may collect, use, store, synchronize, protect and delete information associated with the application.

2. DEVELOPER

SABDHAM is an independent personal software project developed and published using the name Santh Creatives.

Santh Creatives is not represented as a registered company or corporation.

3. ACCOUNT DATA

When account functionality is used, SABDHAM may process:
• email address;
• display name;
• account/user identifier;
• authentication provider;
• avatar/profile image;
• profile information; and
• session and authentication information.

4. LIBRARY, PLAYBACK AND PERSONALIZATION DATA

SABDHAM may store or synchronize:
• liked-song identifiers;
• playlists and playlist contents;
• recently played items;
• imported playlist information;
• custom song references;
• playback-interest or personalization information;
• preferences;
• profile settings; and
• playback-related settings.

5. SEARCH AND EXTERNAL REQUEST DATA

When you search, open a public playlist, resolve a track, request artwork or use similar features, SABDHAM may send the relevant search terms, track identifiers, artist names, album information, playlist identifiers or similar request data to external providers needed to perform that feature.

Like most internet services, those providers may also receive technical information such as your IP address, request time, device/network headers or similar connection data.

6. AUDIO OUTPUT INFORMATION

On supported Android devices, SABDHAM may read system-provided audio-route information so it can display and switch between available phone, Bluetooth or other supported audio outputs.

SABDHAM does not intentionally use audio-route information for precise-location tracking.

7. USE OF INFORMATION

Information may be used to:
• authenticate users and maintain sessions;
• restore accounts;
• synchronize likes, playlists and preferences;
• personalize music discovery;
• provide music search, playlist discovery and playback;
• display and switch supported audio outputs;
• diagnose technical problems;
• prevent abuse and maintain security;
• process account deletion; and
• provide support.

8. AUTHENTICATION SERVICES

SABDHAM may use third-party authentication systems such as Google or Firebase.

Those providers operate under their own privacy policies.

9. HOSTING AND DATABASE PROVIDERS

SABDHAM may use external hosting, database and infrastructure providers.

Information may be processed through those providers where necessary to operate the service.

10. MUSIC, PLAYLIST, METADATA AND ARTWORK SERVICES

Depending on the requested feature, SABDHAM may communicate with services including Spotify, YouTube, Audius, Apple/iTunes, MusicBrainz, Cover Art Archive, Last.fm and TMDB.

These services may process request information according to their own privacy policies and terms.

11. SALE OF PERSONAL INFORMATION

SABDHAM does not sell users' personal information.

12. ADVERTISING

SABDHAM does not intentionally use account information for unrelated advertising profiling.

If advertising or materially different data use is introduced in the future, the Privacy Policy should be updated before that practice is relied upon.

13. DEVICE AND LOCAL STORAGE

SABDHAM may keep limited information locally on the device, including cache data, preferences, library information, playback state and session information.

The web version may use cookies or browser storage where needed for sessions and app state.

Uninstalling the application or clearing application storage may remove local information but does not necessarily delete cloud account data.

14. DIAGNOSTICS AND SECURITY

SABDHAM may process limited technical information needed to detect errors, investigate playback failures, protect accounts and secure the service.

SABDHAM uses reasonable technical measures intended to protect user information, including encrypted HTTPS connections where supported.

No online service can guarantee absolute security.

15. RETENTION

Account data may be retained while an account remains active and for as long as reasonably necessary to provide the service.

Limited technical, security or fraud-prevention records may be retained when necessary for debugging, security, dispute resolution or legal obligations.

16. ACCOUNT DELETION

Users may request account deletion through SABDHAM's account deletion functionality where available.

Deletion is intended to remove personal account and library information that is no longer required, subject to lawful or necessary security retention.

17. SENSITIVE DATA

Unless a future feature specifically requires it and appropriate disclosure is provided, SABDHAM does not intentionally require:
• precise location;
• contact lists;
• SMS history;
• call logs;
• microphone recordings;
• camera recordings; or
• financial account credentials.

18. CHILDREN

SABDHAM does not intentionally seek unnecessary personal data from children.

Applicable age restrictions of authentication and third-party services continue to apply.

19. ACCESS, CORRECTION AND DELETION

Depending on applicable law, users may have rights to request access, correction or deletion of their personal information.

Requests may be submitted through Contact Support.

20. DATA BREACH AND SECURITY EVENTS

If SABDHAM becomes aware of a security event affecting personal data, reasonable steps may be taken to investigate, mitigate and provide legally required notifications.

21. INTERNATIONAL INFRASTRUCTURE

Third-party hosting or service providers may process information in countries different from the user's own country according to their service architecture and applicable safeguards.

22. POLICY UPDATES

This Privacy Policy may change when SABDHAM changes its data practices, infrastructure, functionality or third-party services. The updated date will be changed when material revisions are published.

23. COPYRIGHT REQUESTS

Copyright and content-removal requests may also be submitted through Contact Support.

24. CONTACT

Privacy, account-data, deletion and support requests may be submitted through the Contact Support function within SABDHAM.
""".trimIndent()

internal val SABDHAM_COPYRIGHT_TEXT = """
COPYRIGHT & RIGHTS HOLDER NOTICE

SABDHAM respects copyright, trademark and other intellectual-property rights.

SABDHAM does not claim ownership of third-party songs, sound recordings, compositions, lyrics, album artwork, photographs, artist images, videos, trademarks, artist names or other protected content.

All such rights remain with their respective owners.

Some information or references may originate from publicly accessible internet sources. Public accessibility does not mean that material is copyright-free or licensed for redistribution.

If you are an artist, copyright owner, label, publisher, photographer or authorized representative and believe material accessible through SABDHAM infringes your rights, use Contact Support.

Please include:
• identification of the protected work;
• identification of the disputed content;
• evidence of ownership or authority;
• the requested action; and
• contact details for follow-up.

SABDHAM may disable, restrict or remove disputed material while a rights claim is reviewed.

SABDHAM does not grant users permission to reproduce, redistribute, sell or otherwise commercially exploit third-party copyrighted material.
""".trimIndent()

@Composable
internal fun SabdhamLegalDialog(
    title: String,
    body: String,
    onDismiss: () -> Unit,
    onSupport: (() -> Unit)? = null
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFF0A100D),
        title = {
            Text(
                text = title,
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 520.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = body,
                    color = Color(0xFFD3D8D5),
                    fontSize = 13.sp,
                    lineHeight = 20.sp
                )
            }
        },
        confirmButton = {
            Row {
                if (onSupport != null) {
                    TextButton(onClick = onSupport) {
                        Text("Contact Support", color = Color(0xFF39E67A))
                    }
                }

                TextButton(onClick = onDismiss) {
                    Text("Close", color = Color(0xFF39E67A))
                }
            }
        }
    )
}
