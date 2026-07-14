---
layout: page
title: Building in Public
permalink: /building-in-public/
---

I'm building a business in the open, one daily post at a time: what I ship, what I learn, what works and what doesn't.

The yardstick I'm holding myself to is **$20,000 in monthly recurring revenue**. It's just a metric that tells me I've built something people genuinely want. Start at day one and read forward.

{% assign journey = site.categories['building-in-public'] | sort: 'date' %}
{% if journey.size > 0 %}
<ul class="post-list">
  {% for post in journey %}
  <li>
    <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
    </h3>
  </li>
  {% endfor %}
</ul>
{% else %}
_The first entry is coming soon._
{% endif %}
