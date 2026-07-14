---
layout: page
title: Blog
permalink: /blog/
---

Thoughts on building products, startups, and whatever else is on my mind. I'm also [Building in Public]({{ "/building-in-public/" | relative_url }}) with daily posts.

<ul class="post-list">
  {% for post in site.posts %}
  <li>
    <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">{{ post.title | escape }}</a>
    </h3>
  </li>
  {% endfor %}
</ul>
