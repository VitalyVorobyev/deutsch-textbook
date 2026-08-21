# Mobile Application Manifest

**Status:** Proposed
**Purpose:** Define the mobile extension of the interactive German textbook
**Target platforms:** iOS and Android
**Primary technology:** Installable Progressive Web App

## Objective

Extend the existing React application into a mobile application that users can install on iPhone and Android devices without publishing it through the Apple App Store or Google Play.

The mobile application must reuse the existing frontend codebase and remain usable without a mandatory backend service.

## Architectural Decision

The primary mobile distribution format shall be a **Progressive Web App (PWA)**.

The PWA will:

* run from the existing React and Vite application;
* support installation on both iOS and Android;
* appear on the device home screen;
* run in a standalone application window;
* support offline-capable lessons and exercises;
* store user progress locally;
* update automatically from the hosted web version;
* require no app-store publication.

A separate React Native application is not part of the initial scope.

## Distribution Model

The application shall be distributed through a public HTTPS URL.

Users receive either:

* a direct application link;
* a QR code pointing to the application;
* a simple installation page with platform-specific instructions.

Installation flow:

### Android

1. Open the application URL in a supported browser.
2. Select **Install app** or **Add to Home screen**.
3. Launch the application from the home screen.

### iOS

1. Open the application URL in Safari.
2. Select **Share**.
3. Select **Add to Home Screen**.
4. Launch the application from the home screen.

The project shall include an in-application installation guide when automatic installation prompting is unavailable.

## Hosting

The frontend shall be deployable as static files to any HTTPS-capable hosting service.

The hosted application is required for distribution but does not imply a backend service.

Initial hosting may use:

* the project's existing web hosting;
* Cloudflare Pages;
* another static hosting provider;
* a local-network web server for private testing.

Public distribution requires a stable public HTTPS address.

## Local-First Operation

Core textbook functionality must not depend on a backend.

The application shall store locally:

* settings;
* learning progress;
* vocabulary training state;
* completed exercises;
* bookmarks;
* downloaded lesson metadata;
* offline content state.

Structured data shall use IndexedDB. Small preferences may use local storage.

Lesson content, images, and selected audio resources shall be cacheable for offline use.

## Optional Backend

Backend integration shall remain optional and hidden behind repository or service interfaces.

Possible future backend responsibilities include:

* synchronization between devices;
* user accounts;
* content updates;
* backup and restore;
* generation of exercises or audio;
* learning analytics.

The initial application must function when no backend is configured.

A backend running on a laptop or home server may be used during development through the local network, but it is not part of the mobile distribution mechanism.

## Platform Abstraction

Application code shall not directly depend on browser storage, network APIs, or desktop APIs.

Platform-specific functionality shall be exposed through abstractions such as:

```text
ContentRepository
ProgressRepository
SettingsRepository
AudioService
InstallationService
UpdateService
```

Initial implementations will target the browser and PWA environment.

## Required PWA Components

The implementation shall provide:

* a web application manifest;
* application icons for supported device sizes;
* standalone display mode;
* a service worker;
* application-shell caching;
* offline fallback behavior;
* versioned content caches;
* controlled application updates;
* responsive mobile layouts;
* safe-area support for modern phones;
* installation instructions for iOS and Android.

## Android Native Package

A directly downloadable Android APK may be introduced later if the PWA proves insufficient.

This package should wrap or reuse the existing web application rather than introduce a second independent UI implementation.

APK distribution would use:

* a signed release APK;
* download from the project website;
* explicit user approval for installation from that source;
* a documented update mechanism.

The APK is optional and is not required for the first mobile release.

## iOS Native Package

Direct native iOS distribution is explicitly outside the initial scope.

The project shall not depend on:

* App Store publication;
* TestFlight;
* Apple alternative marketplaces;
* Apple Web Distribution;
* periodic manual re-signing through Xcode.

For iOS users, the PWA is the supported no-store installation mechanism.

## Initial Deliverable

The first implementation milestone is complete when:

1. The existing React application is responsive on phone screens.
2. It can be installed on Android and iOS home screens.
3. It launches in standalone mode.
4. Core lessons remain available after temporarily losing network access.
5. User progress persists locally.
6. A public URL and QR code provide the distribution entry point.
7. Installation instructions are shown for both platforms.
8. Updating the hosted application makes a new version available without manual package installation.

## Implementation Planning Request

Based on this manifest, produce a detailed implementation plan covering:

* required changes to the React and Vite project;
* recommended PWA tooling;
* manifest and service-worker configuration;
* IndexedDB persistence architecture;
* offline content and audio caching;
* responsive mobile UI work;
* installation UX for iOS and Android;
* update and cache-versioning strategy;
* static deployment;
* testing on physical iOS and Android devices;
* phased implementation tasks with acceptance criteria.
