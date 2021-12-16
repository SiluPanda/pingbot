## Introduction

This is a very tiny telegram bot which can monitor a web service for it;s status and alert on telegram for any status change
The frequency of ping is now 10 seconds

## Getting Started

Currently the bot is hosted on a cloud service, so it can be used right away through the Telegram bot: t.me/uppppbot.
Else, it can easily be configured locally.

## Local Setup

### Requirements:
- A mongoDB database cluster (it needs to create one collection named `pingbot` to store the service statuses)
- A Telegram bot to listen to

### Steps:

- Clone the repo
- Create a telegram bot, get the token, also create a mongoDB cluster url
- Create a file `.env` and add the following varibles
```
MONGO_URI=<>
TELEGRAM_TOKEN=<>
```
- Install dependencies by running `npm install`
- Run with `node index.js`
