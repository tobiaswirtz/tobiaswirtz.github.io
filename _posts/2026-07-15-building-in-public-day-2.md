---
layout: post
title:  "Building in Public: Day 2"
date:   2026-07-15 09:00:00 +0200
categories: building-in-public
---

Day 2. Three things on the list today: line up interviews, find a way to reach cold customers, and figure out what it actually takes to deploy.

## Interviews from my own network

I reached out to people I already know and set up two interviews with contacts for whom this might be relevant. Warm intros first, because the fastest way to find out whether the knowledge-loss pain is real (hypothesis 1) is to talk to people who will actually pick up the phone.

Two is a start, not a signal. The goal for the next few days is to keep this pipeline filling.

## A cold outreach source for ICP customers

I need a repeatable way to reach companies I don't know. Today I had an AI agent qualify **23 companies** against my ICP — German Mittelstand manufacturers, roughly 50 to 500 people — as a candidate list to reach out to.

The list is the easy part. Whether any of them respond to a cold approach is the actual test, and I haven't run it yet.

## What it takes to deploy

I spent time working out what it would actually take to put the MVP in front of a real company, and found two blockers that cut straight against my value prop of European data residency and self-hosting:

1. **Multi-tenancy.** The MVP wasn't built to cleanly separate one customer's data from another's. If I'm selling data residency and trust, that has to be airtight before anyone real touches it.
2. **US-hosted dependencies.** Some of the libraries I'm using are served from American CDNs. "No US subprocessors anywhere" doesn't hold if the browser is quietly pulling assets from the US on every page load.

On the plus side, I turned the deployment work into a **runbook** — a written, repeatable set of steps for standing up the MVP — so this isn't knowledge that only lives in my head.

## Hypotheses

No progress on any of my hypotheses today. Everything I did was setup: pipeline, list, infrastructure. Necessary, but none of it moved a single assumption from "I think" to "I know." The interviews are where that starts to change.

Tomorrow: run the interviews I lined up and start closing the deployment gaps.
