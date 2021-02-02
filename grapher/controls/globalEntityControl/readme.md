# Global Entity Control

This component allows users to change the Entity Selection across all the Graphers on a single HTML page.

## Context

We have a number of Wordpress blog posts that embeds multiple Graphers. If a user wants to see a seleciton like "Canada and France" across all the Graphers on that post, they can use the Global Entity Control to do it, if the author has put one on that page.

## Testing

There is a test route in the mocksiterouter called `/multiEmbedderTest` for
testing things.

## How to use

1. Put multiple Graphers in one HTML page.
2. Put a `<div data-global-entity-control />` tag in the page.
3. Now when the page loads, our hydrate function will hydrate the component.
