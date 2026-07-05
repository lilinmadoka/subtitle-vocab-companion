# Subtitle Vocab Companion

This context names the core product concepts for a browser extension that supports personal subtitle-based vocabulary study.

## Language

**Language Reactor Companion**:
A study helper that saves subtitle vocabulary and related context already visible to the user through the page or Language Reactor. It is not a general subtitle scraping tool.
_Avoid_: Generic subtitle scraper, subtitle downloader, site-wide subtitle extractor

**Supported Site**:
A website where the Language Reactor Companion is allowed to run its LR-based capture flow. Support does not mean the extension reads that site's native subtitle system.
_Avoid_: Native subtitle support, full site support

**LR Capture Flow**:
A save flow based on subtitle, translation, and dictionary content that is already visible to the user through the page or Language Reactor.
_Avoid_: Hidden media extraction, subtitle file scraping

**Native Subtitle System**:
The subtitle feature provided directly by a media site, outside the Language Reactor companion workflow. Native subtitle systems are out of scope unless the product boundary changes.
_Avoid_: Built-in captions as a capture source

**Experimental Site**:
A supported site whose LR workflow has not been verified to the same confidence as the primary sites. Claims about an experimental site should stay conditional and narrow.
_Avoid_: Official support, full support

**Vocabulary Card**:
A saved study record centered on one selected word or short phrase, with its visible subtitle context, translation context, dictionary note, source, and playback time when available.
_Avoid_: Subtitle archive, transcript record
