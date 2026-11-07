# Select

A labelled field that opens a bottom sheet of option rows, for a choice from a long list, such as the wilaya, the commune or the school in setup (answers 802 and 804). Long lists use selects, not chips.

- **Provide** the label and the options, each a value and its name. The field shows the chosen option's name, and nothing when none is chosen: no placeholder or helper text.
- The sheet's title is the label. The chosen row is ticked. A list of more than 8 options starts with a search field, which matches any part of a name, ignoring case, accents and Arabic diacritics.
- Choosing a row closes the sheet; closing it chooses nothing. With no options, the field is disabled.
- The field is at least 48px tall, with a 1.5px border on `sheet`, like the text field, and a chevron pointing down.
- **Canvas:** none yet; drawn at the next design system export.
