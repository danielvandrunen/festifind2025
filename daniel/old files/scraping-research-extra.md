# Festival Websites Scraping Research

## Introduction

This document presents findings from an investigation of the DOM structure of several festival websites that are targets for the FestiFind project. The research focused on examining how closely the implementation guides match the actual website structures and identifying any necessary adjustments.

## Website Analysis

### 1. Partyflock (https://partyflock.nl/agenda/festivals)

**Current Structure:**
- Uses a table-based layout for festival listings
- Festivals appear as `<tr>` elements with data in various `<td>` cells
- Festival names found in the first table cell, often with `[itemprop="name"]` attributes
- Location information in the third table cell
- Detail pages contain date information and multi-day event details

**Implementation Guide Alignment:**
- The guide correctly identifies the table-based structure
- The selectors for festival names, locations, and date information match the observed patterns
- Detail page handling approach is appropriate for the site structure

**Challenges:**
- Complex DOM structure that can lead to script execution issues
- Potential for anti-scraping measures that limit DOM traversal

### 2. Festileaks (https://festileaks.com/festivalagenda/)

**Current Structure:**
- Card-based layout for festival listings
- Pagination with complex URL parameters
- Festival details spread across structured elements within cards
- Cookie consent dialog on initial visit

**Implementation Guide Alignment:**
- Pagination approach correctly handles the URL parameter structure
- Festival card selectors identify the right elements
- Detail page extraction logic is appropriate

**Challenges:**
- Cookie consent dialog needs to be handled
- Content may be dynamically loaded, requiring wait times

### 3. Befesti (https://befesti.nl/festivalagenda)

**Current Structure:**
- Modern, clean interface with card-like festival elements
- Date information in `.agenda--datum--double` divs with day-start and day-end elements
- Festival names in `h3` elements with `data-element="card-title"` attributes
- Location information in `.agenda--chip` elements
- Filtering options for month, city, genres, etc.
- Infinite scrolling or "Load More" functionality

**Implementation Guide Alignment:**
- Selectors match the actual element attributes and classes
- The guide correctly identifies the scrolling/load more pattern
- Approach to extracting dates from separate elements is appropriate

**Challenges:**
- Cookie consent dialog appears on first visit
- Filters may affect the festival listings that appear

### 4. FollowTheBeat (https://followthebeat.nl/agenda/)

**Current Structure:**
- List-based design with festivals in `<li>` elements
- Festival names in `<span>` elements
- Dates displayed in a "DD - DD" format with month abbreviation
- Location information in nested `<span>` elements
- Genre/style tags displayed as pills (DISCO, HARD HOUSE, etc.)
- Simple pagination via "/page/{number}/" URLs

**Implementation Guide Alignment:**
- Pagination pattern matches the site structure
- The list-based approach is correctly identified
- Festival information extraction logic is appropriate

**Challenges:**
- Genre tags need specific extraction logic
- List structure has nested elements that require careful traversal

## Recommendations

### General Updates for All Guides

1. **Cookie Consent Handling**
   - Add standard code to handle cookie consent dialogs across all scrapers
   - Include wait and retry logic after consent actions

2. **Error Resilience**
   - Implement more robust error handling for DOM traversal
   - Add fallback selectors when primary ones fail
   - Use XPath as an alternative when complex CSS selectors fail

3. **Selector Flexibility**
   - Use multiple selection strategies (CSS, XPath, text content)
   - Implement fuzzy matching for text-based element identification
   - Add validation to confirm selected elements contain expected data

4. **Progressive Enhancement**
   - First gather basic data from list views
   - Only fetch detail pages when necessary for missing information
   - Cache successful selector patterns for reuse

### Specific Guide Updates

#### Partyflock Guide
- Simplify selector patterns to reduce DOM traversal depth
- Add specific handling for different table row types
- Implement pagination detection for "Show More" functionality

#### Festileaks Guide
- Add code to handle the cookie consent dialog
- Update festival card selectors with current class names
- Ensure pagination parameter format is current
- Add validation for dynamically loaded content

#### Befesti Guide
- Add explicit handling for cookie consent
- Implement filter manipulation to ensure all festivals are visible
- Enhance scroll detection to ensure all content is loaded

#### FollowTheBeat Guide
- Update selectors to target `<li>` elements with the proper classes
- Add extraction logic for genre/style tags
- Improve date parsing for the "DD - DD month" format

## Conclusion

The implementation guides are generally well-aligned with the current website structures, but the recommended adjustments will make the scraping process more robust against site changes and error conditions. Regular monitoring of these sites is recommended as festival websites frequently update their designs and structures.

The modular architecture described in the general implementation guide remains appropriate, allowing for individual scrapers to be updated without affecting the entire system.