---
layout: post
title:  "Building in Public: Day 2"
date:   2026-07-15 09:00:00 +0200
categories: building-in-public
---

Day 2. Three things on the list today: line up interviews, find a way to reach cold customers, and figure out what it actually takes to deploy.

## Interviews from my own network

I reached out to people I already know and set up two interviews with contacts for whom this might be relevant. Warm intros first, because the fastest way to find out whether the knowledge-loss pain is real (hypothesis 1) is to talk to people who will actually pick up the phone.

## A cold outreach source for ICP customers

I need a repeatable way to reach companies I don't know. Today I had an AI agent qualify **23 companies** against my ICP as a candidate list to reach out to. I will reach out to these companies tomorrow.

## What it takes to deploy

I spent time working out what it would actually take to put the MVP in front of a real company, and found two blockers:

1. **Multi-tenancy.** The MVP wasn't built to cleanly separate one customer's data from another's. This obviously has to change if I want to deploy it.
2. **US-hosted dependencies.** Some of the libraries I'm using are served from American CDNs. Need to be substituted to ensure European hosting and data residency.

On the plus side, I turned the deployment work into a **runbook**, a written, repeatable set of steps for shipping the MVP, so this isn't knowledge that only lives in my head.

## Hypotheses

No progress on any of my hypotheses today. Everything I did was setup: pipeline, list, infrastructure.

## Random Thoughts
I found a great video on growth hacks that I will take some inspiration from. Check it out [here](https://www.youtube.com/watch?v=7UrrqBIUs_g).

## Tomorrow

1. Do cold outreach to the 23 companies mentioned above
2. Create a Business Model Canvas to be very clear about what I am building.
3. Do one of the customer interviews
