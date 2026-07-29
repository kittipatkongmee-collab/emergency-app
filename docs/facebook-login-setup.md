# Facebook login setup

Create a Meta app, enable Facebook Login, register Android/iOS identifiers and callback settings, then provide `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` and the approved Graph API version. Flutter obtains the provider token; only NestJS verifies it and issues system JWTs. Never ship the app secret in Flutter.
