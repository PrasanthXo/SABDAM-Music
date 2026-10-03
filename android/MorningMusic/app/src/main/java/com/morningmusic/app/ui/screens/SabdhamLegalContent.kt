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

Developed and published by Santh Creatives.

Santh Creatives is the developer/publisher name used for this independent personal software project. It is not represented as a registered company, corporation, record label or music licensing organisation.

SABDHAM is an independent music discovery, playback, playlist and personal music-library application.

SABDHAM may display or reference music information, metadata, artwork, artist information, streaming references and other material supplied by third-party services or publicly accessible internet sources.

SABDHAM and Santh Creatives do not claim ownership of third-party musical works, recordings, lyrics, artwork, photographs, trademarks, videos, artist names or other protected intellectual property.

All third-party rights remain with their respective owners, artists, labels, publishers, licensors, photographers, platforms and other rights holders.

The fact that material can be accessed publicly on the internet does not mean that it is copyright-free, in the public domain or licensed for unrestricted redistribution.

Rights holders may use Contact Support to request review, correction, restriction or removal of material.
""".trimIndent()

internal val SABDHAM_TERMS_TEXT = """
SABDHAM TERMS & CONDITIONS

Developer / Publisher: Santh Creatives
Application: SABDHAM
Last updated: 29 September 2026

1. ACCEPTANCE

By accessing, installing or using SABDHAM, you agree to these Terms & Conditions. If you do not agree, discontinue use of the application.

2. INDEPENDENT PROJECT

SABDHAM is an independently developed personal software project.

Santh Creatives is a developer/publisher name and is not represented as a registered company, corporation, record label or music licensing organisation.

3. SERVICE PURPOSE

SABDHAM may provide music search, discovery, playback, playlists, liked songs, library management, imported playlists, user accounts, preferences, metadata, artwork and related functionality.

Features may be changed, limited or removed at any time.

4. THIRD-PARTY CONTENT

SABDHAM does not claim ownership of third-party songs, recordings, compositions, lyrics, artwork, photographs, videos, artist identities, trademarks, metadata or other protected material.

Rights remain with the applicable artists, copyright owners, labels, publishers, licensors, photographers and platforms.

5. PUBLIC INTERNET MATERIAL

Some information or media references may originate from publicly accessible internet sources.

Public availability must not be interpreted as proof that material is copyright-free or that SABDHAM or its users have permission to redistribute, reproduce or commercially exploit it.

6. NO CONTENT LICENCE GRANTED

Use of SABDHAM does not grant users a copyright licence or ownership right in third-party content.

Users remain responsible for complying with copyright and other applicable laws.

7. THIRD-PARTY SERVICES

SABDHAM may depend on external APIs, authentication providers, databases, metadata providers, hosting services, media providers or streaming services.

Those services are governed by their own terms and policies.

Santh Creatives cannot guarantee their continued operation, availability or accuracy.

8. CONTENT AVAILABILITY

Any track, playlist, artwork, metadata item or external resource may become unavailable or restricted without notice.

9. USER RESPONSIBILITY

Users must not knowingly use SABDHAM to:
• infringe intellectual-property rights;
• distribute unauthorized protected material;
• bypass security systems;
• gain unauthorized access;
• abuse accounts or services;
• impersonate others;
• interfere with application infrastructure; or
• violate applicable law.

10. USER ACCOUNTS

Users are responsible for protecting access to their devices and authentication methods and for promptly reporting suspected unauthorized account use.

11. LIBRARY AND SYNCHRONIZATION DATA

SABDHAM may store and synchronize playlists, likes, profile information, settings, recently played information and related account data.

Synchronization is a convenience feature and must not be considered a guaranteed permanent backup.

12. SERVICE MODIFICATION

SABDHAM may modify, suspend or discontinue features for technical, legal, copyright, security, maintenance, operational or policy reasons.

13. AS-IS SERVICE

To the maximum extent permitted by law, SABDHAM is provided on an "as is" and "as available" basis.

No guarantee is made that operation will always be uninterrupted, error-free or compatible with every device or network.

14. THIRD-PARTY INFORMATION

External metadata, images, links and media information may occasionally be inaccurate, incomplete, unavailable or outdated.

15. NETWORK AND SERVICE OUTAGES

Santh Creatives is not responsible for outages caused by internet connectivity, hosting providers, third-party APIs, authentication systems, external platforms or circumstances outside reasonable control.

16. LIMITATION OF LIABILITY

To the maximum extent permitted by applicable law, Santh Creatives will not be responsible for indirect, incidental, consequential or special losses caused by use or inability to use SABDHAM, third-party service failures, synchronization failures, unavailable content or network problems.

Nothing in these Terms excludes rights or liabilities that cannot legally be excluded.

17. COPYRIGHT AND RIGHTS-HOLDER REQUESTS

SABDHAM respects intellectual-property rights.

Copyright owners and authorized representatives may request review or removal of disputed material through Contact Support.

A request should include:
• identification of the protected work;
• identification of the disputed material;
• evidence of ownership or authority;
• the requested action; and
• contact details for follow-up.

SABDHAM may restrict or remove disputed material while a claim is reviewed.

18. NO WARRANTY OF CONTENT RIGHTS

SABDHAM does not guarantee that every third-party content source has granted SABDHAM redistribution or streaming rights.

A rights holder may request removal or restriction at any time.

19. ACCOUNT RESTRICTIONS

Accounts may be restricted or terminated where reasonably necessary to address abuse, fraud, security threats, legal obligations or serious violations of these Terms.

20. ACCOUNT DELETION

Where account deletion is available, deletion may permanently remove profile details, playlists, likes, settings and associated account information, subject to limited retention required by law or security requirements.

21. USER DATA LOSS

Users should not rely on SABDHAM as their sole permanent archive for playlists or other important information.

22. SECURITY

Users must not attempt to probe, attack, disrupt or circumvent SABDHAM security or infrastructure.

23. CHANGES TO TERMS

These Terms may be updated when SABDHAM changes its functionality, infrastructure, legal requirements or third-party services.

24. SEVERABILITY

If any provision is found unenforceable, the remaining provisions should continue to apply to the extent permitted by law.

25. MANDATORY RIGHTS

Nothing in these Terms is intended to waive mandatory consumer, privacy or statutory rights that cannot legally be waived.

26. CONTACT

Support, copyright, privacy, legal and removal requests may be submitted through the Contact Support function inside SABDHAM.
""".trimIndent()

internal val SABDHAM_PRIVACY_TEXT = """
SABDHAM PRIVACY POLICY

Developer / Publisher: Santh Creatives
Application: SABDHAM
Last updated: 29 September 2026

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
• profile information;
• session and authentication information.

4. LIBRARY DATA

SABDHAM may store or synchronize:
• liked-song identifiers;
• playlists;
• playlist contents;
• recently played items;
• imported playlist information;
• custom song references;
• preferences;
• profile settings;
• playback-related settings.

5. USE OF INFORMATION

Information may be used to:
• authenticate users;
• maintain sessions;
• restore accounts;
• synchronize likes and playlists;
• restore preferences;
• provide requested features;
• diagnose technical problems;
• prevent abuse;
• maintain security;
• process account deletion; and
• provide support.

6. AUTHENTICATION SERVICES

SABDHAM may use third-party authentication systems such as Google or Firebase.

Those providers operate under their own privacy policies.

7. HOSTING AND DATABASE PROVIDERS

SABDHAM may use external hosting, databases and infrastructure services.

Information may be processed through those providers where necessary to operate the service.

8. SALE OF PERSONAL INFORMATION

SABDHAM does not sell users' personal information.

9. ADVERTISING

SABDHAM does not intentionally use account information for unrelated advertising profiling unless future functionality introduces this practice with appropriate disclosure.

10. DEVICE STORAGE

SABDHAM may keep limited information locally on the device, including cache data, preferences, library information and session information.

Uninstalling the application or clearing application storage may remove local information but does not necessarily delete cloud account data.

11. SECURITY

SABDHAM uses reasonable technical measures intended to protect user information.

Internet communications should use encrypted HTTPS where supported.

No online service can guarantee absolute security.

12. RETENTION

Account data may be retained while an account remains active and for as long as reasonably necessary to provide the service.

Limited technical or security records may be retained when necessary for fraud prevention, debugging, security, dispute resolution or legal obligations.

13. ACCOUNT DELETION

Users may request account deletion through SABDHAM's account deletion functionality where available.

Deletion is intended to remove personal account and library information that is no longer required, subject to lawful or necessary security retention.

14. THIRD-PARTY MUSIC SERVICES

SABDHAM may communicate with third-party music, metadata, artwork, media and streaming-related services.

Technical requests may include search queries, track identifiers, IP/network information or similar information required to deliver a requested resource.

Third-party processing is governed by the relevant provider.

15. SENSITIVE DATA

Unless a future feature specifically requires it and appropriate disclosure is provided, SABDHAM does not intentionally require:
• precise location;
• contact lists;
• SMS history;
• call logs;
• microphone recordings;
• camera recordings; or
• financial account credentials.

16. CHILDREN

SABDHAM does not intentionally seek unnecessary personal data from children.

Applicable age restrictions of authentication and third-party services continue to apply.

17. ACCESS, CORRECTION AND DELETION

Depending on applicable law, users may have rights to request access, correction or deletion of their personal information.

Requests may be submitted through Contact Support.

18. DATA BREACH AND SECURITY EVENTS

If SABDHAM becomes aware of a security event affecting personal data, reasonable steps may be taken to investigate, mitigate and provide legally required notifications.

19. INTERNATIONAL INFRASTRUCTURE

Third-party hosting or service providers may process information in countries different from the user's own country according to their service architecture and applicable safeguards.

20. POLICY UPDATES

This Privacy Policy may change when SABDHAM changes its data practices, infrastructure, functionality or legal obligations.

21. COPYRIGHT REQUESTS

Copyright and content-removal requests may also be submitted through Contact Support.

22. CONTACT

Privacy, account-data, deletion and support requests may be submitted through the Contact Support function within SABDHAM.

The underlying support email address is intentionally not displayed in the application interface.
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
