# Changelog

## [0.52.0] - 2026-10-07

### Changed

- **Requires `@iyulab/components` 2.8.0** (peer `>=2.8.0`) — for its locale change notification.

### Fixed

- **`flex-table` follows a runtime locale switch.** `Locale.set()` or registering strings (`flexTableLocale.register`)
  re-renders the table at once — menus, filters, empty states and a cell's error marker (now looked up when drawn). It
  kept the old language until a scroll or data change redrew it. A table detached during the switch catches up when
  attached again.

## [0.51.0] - 2026-10-06

### Fixed

- **A data-source failure the server said nothing about is described in the table's language.** With no message in
  the response, `SourceError.message` was a fixed English `Request failed (<status>)`; with no response at all it was
  the transport's exception text, which differs by browser (`Failed to fetch`, `NetworkError when attempting to fetch
  resource.`). Both rendered in English in any locale, and telling them from a server sentence meant matching the
  string's shape. They now come from `flexTableLocale` — `requestFailed` (`{status}` parameter) and `networkFailed`
  (en and ko built in, others via `register`). A server sentence still wins.

### Added

- `SourceError.cause` — on a failure with no response, the exception the transport threw (for diagnostics).

## [0.50.4] - 2026-10-06

### Fixed

- **`useODataSource` reports `loading: true` from the first render** until the first response settles. The first
  render used to return `loading: false` with no rows before the request went out, so a screen that shows an empty
  state on `!loading && totalCount === 0` flashed "no results" for a frame on every mount. Mounting with
  `enabled: false` already reported `loading: true`; both paths now follow one rule.

## [0.50.3] - 2026-10-06

### Documentation

- README Quick Start looks the table up by its tag (`document.querySelector('flex-table')`), so the element is
  typed in TypeScript and its `columns` / `data` are checked — `getElementById` gives a plain `HTMLElement`.

## [0.50.2] - 2026-10-06

### Documentation

- Shift+F10 and the context-menu key on the active cell open the cell menu at that cell (and fire
  `context-menu`) — documented and covered by a test. It works since 0.50.1, whose roving focus puts the
  focus on the cell the browser opens the menu for.

## [0.50.1] - 2026-10-06

### Fixed

- **Screen readers hear the active cell.** The table kept the focus on itself and marked the active cell
  with a class only, so assistive technology announced the grid and nothing as the arrow keys moved
  (the host cannot point `aria-activedescendant` into its own shadow tree). The focus now sits on the
  active cell — or the active header cell — while the table has it (roving focus): each move is announced
  with the cell's row, column and content. `document.activeElement` is still the table.
- When scrolling moves the focused cell out of the rendered window, the focus waits on the table instead
  of staying on a recycled cell that now shows another row; the next key brings it back onto the active
  cell.

## [0.50.0] - 2026-10-06

### Fixed

- **Tab no longer traps the focus in the table.** Tab past the last cell (Shift+Tab before the first)
  stayed on that cell, so keyboard focus could never leave the table (WCAG 2.1.2). Tab still walks the
  cells; at either end it now moves on to the next (previous) control on the page.

### Added

- **The header row is reachable by keyboard.** ArrowUp from the first row moves onto the column's header
  cell; ArrowLeft / ArrowRight / Home / End move along the header and ArrowDown returns to the body. On a
  header cell, Enter or Space sorts (Shift adds the column to the sort), Alt+ArrowDown or the context-menu
  key opens the column menu, and Alt+ArrowLeft / Alt+ArrowRight resize the column. Escape from that menu
  returns to the same header cell. An empty table keeps the header row reachable.
- Keyboard focus arriving on a table with nothing active activates the first cell, so the first arrow
  key already moves and no Tab is spent entering.

### Changed

- **The column menu buttons are no longer Tab stops** (`tabindex="-1"`, like the row checkboxes) — the
  table is one Tab stop and the header row reaches each column's menu. Pages that relied on tabbing to a
  menu button reach it from the header row instead.

## [0.49.1] - 2026-10-06

### Fixed

- **The column filter is a dialog with a keyboard contract.** It is announced as a dialog named for its
  column ("Filter Customer"); Tab and Shift+Tab stay inside it (it floats over the table, so focus that
  left it would leave it open behind the next control); Escape closes it and returns focus to that
  column's menu button — before, focus dropped to the page. A click outside still closes it without
  moving focus.

## [0.49.0] - 2026-10-06

### Added

- **Typed events.** `FlexTableEventMap` (exported, with `CellChange`) maps each of the 31 event names to
  its `CustomEvent<detail>`, and `FlexTable` overloads `addEventListener`/`removeEventListener` with it:
  `table.addEventListener('sort-change', (e) => e.detail.criteria)` type-checks without a cast. Before,
  a TypeScript listener got a plain `Event`. The names stay off the global event map on purpose — several
  are generic (`sort-change`, `selection-change`) and would collide with other libraries.
- The element dispatches every event through one helper keyed on the map, so a detail that drifts from
  the documented shape no longer compiles.

### Changed

- **React `on*` props carry the detail types** (they were `CustomEvent<any>`). A handler that declared a
  detail shape the event never had now fails to type-check — that is the point; handlers typed as plain
  `CustomEvent` keep working.

### Documentation

- The README's event tables list the seven events they were missing (`row-reorder`, `data-import`,
  `fill-handle-apply`, `find-replace`, `comment-change`, `column-visibility-change`,
  `header-context-menu`).

### Fixed

- The package no longer ships empty `.d.ts` files for its own tests.

## [0.48.6] - 2026-10-06

### Fixed

- **The cell-comment box is named** ("Add comment"); it had only its placeholder.

## [0.48.5] - 2026-10-06

### Fixed

- **The form controls the grid draws are named.** Cell editors (text, number, select, date and the
  autocomplete input) had no name and are now named by the column header; the autocomplete editor
  is a combobox whose suggestions are a listbox of options, with the highlighted one announced. In
  the filter dropdown — now a group named "Filter {column}" — the match-mode select, the filter text,
  each numeric condition's operator and value, the condition join and the blank-cells select are
  named (the blank-cells label sat next to its select without being tied to it). The find and
  replace boxes were named only by their placeholder. New locale keys: `findInput`,
  `replaceInput`, `filterFor`, `filterMatchMode`, `filterText`, `conditionOperator`,
  `conditionValue`, `conditionJoin`.

## [0.48.4] - 2026-10-06

### Fixed

- **The find panel's controls are named.** The previous, next and close buttons held only `◀`, `▶`
  and `✕`, and the two option checkboxes were labelled `Aa` and `[ ]`, so assistive technology read
  symbols. They are now named from the locale ("Previous match", "Next match", "Close find", "Match
  case", "Whole cell") and the buttons declare their keys with `aria-keyshortcuts`; the tooltips keep
  showing the key. The no-match count ("0 results") was a fixed English string and now comes from
  the locale too (new key `findNoResults`).
- **Row selection has a keyboard path, and the row checkboxes are no longer Tab stops.** With
  `selectable`, every rendered row checkbox was in the Tab order and none had a name, so Shift+Tab
  from the control after the grid landed on an unnamed checkbox, and selecting rows from the
  keyboard meant tabbing through them. Shift+Space now selects (and deselects) the active cell's row
  — Space alone still types into an editable cell — and the checkboxes are named ("Select row",
  "Select all rows"; new keys `selectRow`, `selectAllRows`) and kept out of the Tab order.
- The locale values of `findPrevious`, `findNext` and `closeFind` no longer embed the key in
  parentheses — the key is added to the tooltip separately. An app that registered its own wording
  for these keys keeps it.

## [0.48.3] - 2026-10-06

### Fixed

- **Enter and Space on a column menu button open the menu while a cell is active.** The grid read
  the key as its own and started editing the active cell instead. Keys pressed on a control inside
  the grid — a column menu button, a row checkbox, a button a cell renders — are now that control's;
  the grid's cell keys apply while the grid itself has focus. Ctrl/Cmd shortcuts still apply.

## [0.48.2] - 2026-10-06

### Fixed

- **Ctrl+C / Ctrl+X / Ctrl+V apply again while a row checkbox has focus.** 0.48.0 treated every
  `<input>` as a text field with its own clipboard, so with focus on a row checkbox the keys did
  nothing. Only text fields (the cell editor, the find panel's search box, a filter input) keep
  their own clipboard now (`isTextEntry` from `@iyulab/components` 2.2.0).

### Changed

- Requires `@iyulab/components` 2.2.0 or later.

## [0.48.1] - 2026-10-06

### Fixed

- **Cmd+C and Cmd+X work in Safari again.** 0.48.0 moved the keys to the browser's copy/cut events
  alone, and Safari fires no copy event without a text selection — a grid's selection is not one. The
  keys now take the browser's event where it fires and write through the Clipboard API where it does
  not (`copyFromKey`/`pasteFromKey` from `@iyulab/components` 2.1.0). A cut still clears only once
  its text is on the clipboard.

### Changed

- `clipboard-error` again covers the keys: `'copy'` when neither path put the text on the clipboard
  (a cut then clears nothing), `'paste'` when neither could read it.
- Requires `@iyulab/components` 2.1.0 or later.

## [0.48.0] - 2026-10-06

### Fixed

- **Ctrl+X no longer clears cells that never reached the clipboard.** The keys called the async
  Clipboard API; when the write was refused — no permission, a page outside a secure context, a
  browser without it — the table still cleared the cut range and fired `clipboard-cut`
  (`clipboard-copy` for Ctrl+C). Ctrl+C, Ctrl+X and Ctrl+V now go through the browser's own
  copy/cut/paste and `clipboardData`: they need no clipboard permission, work on any page, and a cut
  range is cleared only once its text is on the clipboard.
- The context menu's Copy, which still writes through the Clipboard API, fires `clipboard-copy` only
  when the write succeeds; a refused write fires `clipboard-error` alone.

### Changed

- `clipboard-error` is now only the context menu's Copy (`action: 'copy'`). Paste no longer reads
  through the Clipboard API, so it has no permission to be refused and never reports `'paste'`.
- Copy, cut and paste typed in a text field inside the grid (the cell editor, the find panel) are
  that field's own and leave the cells alone.

### Documentation

- README: the keyboard table covers every key the grid handles, and the column example uses
  `appearance="plain"` (the `variant` attribute was removed in `@iyulab/components` 2.0).

### Tests

- Real key input for Ctrl+C/X/V, Ctrl+Click on a header, and the column menu's Space / Home / End /
  Escape, alongside the rest of the keyboard table.

## [0.47.0] - 2026-10-05

### Changed

- **Breaking: `error` from `useODataSource` and `useArraySource` is a structured failure, not a
  string** — `SourceError | null`, where `SourceError` is `{ message, status?, code?, details?, body? }`
  (exported from `@iyulab/flex-table/react` with `SourceErrorDetail`). The message alone lost which
  failure it was, so an app could not tell a 403 the server marked with its own code (for example
  "password change required") from any other 403, or a 404 from a 409, without wrapping `fetcher`
  to watch the status. Now `status` is the HTTP status, `code` the server's rejection code (OData
  `error.code`), `details` the OData `error.details` entries, and `body` the parsed response (or its
  text). A failure with no response — a network error, or a `@odata.nextLink` the hook refused — has
  a `message` only. The message itself is unchanged.

  Migration: render `error.message` where you rendered `error`
  (`{source.error && <p role="alert">{source.error.message}</p>}`), and compare `error?.message`
  where you compared the string.

- **Date and datetime column filters use `u-date-picker`** for their From and To bounds, like the
  cell editor since 0.46. The native date inputs they replace showed the browser's UI language
  (`10/02/2026` in an English browser) while the table shows ISO; the bounds now read and show
  `YYYY-MM-DD` (`YYYY-MM-DD HH:mm`) everywhere, with a calendar beside each. The bounds are labelled
  (**From**, **To**), each calendar stops at the other bound, and either bound may still stay empty.
  A bound now applies when it is committed — Enter, leaving the box, or a day picked in the calendar —
  rather than on every keystroke. While a calendar is open, Escape closes the calendar and the next
  Escape closes the filter. Opening the filter from the column menu focuses the From bound.

## [0.46.0] - 2026-10-05

### Changed

- **Date and datetime cells edit with `u-date-picker`** from `@iyulab/components` — the same text box
  (`YYYY-MM-DD`, `YYYY-MM-DD HH:mm`, the same short forms and the same rejection of text that is not a
  date) with a calendar beside it. A day picked in a `date` cell's calendar is the new value; in a
  `datetime` cell the day and time are applied together with Apply. While the calendar is open,
  Escape closes it and the next Escape cancels the edit. Stored values are unchanged: `YYYY-MM-DD`,
  and the local `YYYY-MM-DDTHH:mm`. **Requires `@iyulab/components` 2.0.1** (peer `>=2.0.1`, was
  `>=1.56.0`) — the release in which pressing the calendar keeps focus in the picker.

- **A paste leaves the cells it wrote selected**, as spreadsheets do: after Ctrl+V the pasted block
  (including rows it appended) is the selection, so it can be seen, copied, cleared or undone as one
  block. The active cell stays where the paste began. A single-value paste keeps the single-cell
  selection.

### Fixed

- **Typing into a cell editor keeps every key.** The editor was focused and its text selected again on
  every update of the table, so in an autocomplete column — whose list updates on each key — the next
  key replaced what was typed (`apx` became `x`). It is now focused once, when editing starts.

## [0.45.0] - 2026-10-05

### Added

- **Press targets follow `--u-target-size`** (the host's minimum target size from `@iyulab/components`).
  When it is set, rows (and so the header row) are at least that tall — it wins over `row-height` and
  `--ft-row-height`, because it is a floor — and the row-selection column is at least that wide. Column
  menu buttons, menu items, filter fields and the find panel's fields and buttons follow too. Unset,
  nothing changes. The column resize handle and the hidden-column marker keep their size: the column menu
  does the same jobs (Wider · Narrower · Fit to content · Show …) with full-size targets.

### Changed

- **The whole row-selection cell toggles the checkbox**, not just the 16px box (it is now a label). The box
  itself looks the same.

### Fixed

- **The column filter dropdown is no longer cut off by the table.** It was positioned inside the table's
  scroll area, so in a short table its lower controls were hidden and could not be pressed. It now floats
  like the column menu does, below the header (or above it when there is no room).

## [0.44.0] - 2026-10-05

### Added

- **`exportToBlob(format, options?)`** — the export as a `Blob` typed with the format's MIME type.
  XLSX comes out DEFLATE-compressed (platform `CompressionStream`), a fraction of the stored size —
  a 500-row sheet is under a quarter of it.

### Changed

- **`exportToFile` returns `Promise<void>` and downloads a compressed XLSX.** It was synchronous and
  wrote the workbook uncompressed (ZIP STORE). Calling it without `await` still works.
  `exportToString` stays synchronous and still returns an uncompressed workbook for `'xlsx'` — use
  `exportToBlob` when the bytes leave the browser.

## [0.43.0] - 2026-10-04

### Changed

- **Breaking: `useODataSource`'s `onUnauthorized` is called on `401` only.** It was also called on
  `403`, so an app that sends the user to sign in from this hook (its documented use) bounced a
  signed-in user without permission back to the sign-in page — and, after signing in, to the same
  list and the same `403`. A `403` now surfaces only as `error`, like any other failed request.
  Migration: if you handled `403` in `onUnauthorized`, read it from `error` instead.

## [0.42.0] - 2026-10-04

### Added

- **`reveal: 'hover'` column option** — the column's content shows only while its row is hovered,
  holds focus or is selected; for a row-actions column, so a list does not repeat the same buttons
  on every row. The content stays focusable (Tab reveals it), touch screens always show it, and it
  is not printed.

### Changed

- **The virtual scroll renders only the rows it needs above the view.** The first row in view was
  computed as if the header and the frozen rows scrolled away with the body, so up to
  (header + frozen rows) ÷ row height extra rows were rendered above the view — ten with eight frozen
  rows. What is visible does not change.

## [0.41.2] - 2026-10-03

### Fixed

- **The `datetime` cell editor shows and takes `YYYY-MM-DD HH:mm` in every browser language.** It was the
  native `datetime-local` input, which follows the browser's UI language. It is now a text box in local
  time that reads `2026-10-02 14:05` (`9:05`, a date alone is midnight), stores the local
  `YYYY-MM-DDTHH:mm` string as before, and rejects text it cannot read with `validation-error`
  ("Enter a date and time as YYYY-MM-DD HH:mm", new `flexTableLocale` key `notADateTime`).
- **Pasting `2026-10-02 14:05` into a datetime column stores `2026-10-02T14:05`.** Other text stays text.

### Changed

- **The `@iyulab/components` peer is `>=1.56.0`** — date-times are read with its `parseDateTime`.

## [0.41.1] - 2026-10-03

### Fixed

- **The `date` cell editor shows and takes `YYYY-MM-DD` in every browser language.** It was the native
  date input, which shows the browser's UI language (`10/02/2026` in an English browser) whatever the
  page's `Locale`. It is now a text box that also reads `2026/10/2`, `20261002`, `2026. 10. 2.` and
  `10-02` (this year), stores the ISO date string as before, and rejects text that is not a date with
  `validation-error` ("Enter a date as YYYY-MM-DD", new `flexTableLocale` key `notADate`).
- **The editor no longer shifts a date string by a day.** It read `'2026-10-02'` with `new Date()`
  (UTC midnight), which is the previous day west of UTC.
- **Pasting `2026/10/2` into a date column stores `2026-10-02`.** Text that is not a date still stays text.

### Changed

- **The `@iyulab/components` peer is `>=1.55.0`** — dates are read with its `parseDate`.

## [0.41.0] - 2026-10-03

### Added

- **`mergeRepeated` column option — a run of repeated values reads as one merged cell.** For lists of
  child rows under a parent (order lines under an order, boxes under a shipment), the parent's columns
  no longer repeat on every line: the value shows once, on the run's first row, the lines inside the run
  are dropped, and the run keeps one background. `true` merges equal values (empty values never merge);
  a function `(row, previousRow, col) => boolean` decides by any rule — e.g. merge a customer only within
  one order. Every row keeps its own value, so sorting, filtering, copying, export and screen readers
  see each row as before. Rows are compared in display order; the value is drawn again on the first row
  in view and below frozen rows, so scrolling or paging through a run never hides it.

### Fixed

- **Number entry reads a decimal comma.** The `number` cell editor and the number filter used the native
  number input, which turns `1,5` into `15` or an empty value depending on the browser. Both are now text
  fields with a decimal keyboard (`inputmode="decimal"`) that read numbers in the active `Locale` — `1,5`
  is 1.5 and `1.234,5` is 1234.5 on a comma-decimal page — and the editor shows the current value with
  that locale's decimal separator. The filter keeps what you typed while you type it and marks a condition
  it cannot read (`aria-invalid`).
- **Pasting `1,5` into a number column stores 1.5.** Pasted text was read with `Number()`, so a value from a
  comma-decimal spreadsheet stayed text (`"1,5"`) and sorted and summed wrongly. Plain notation (`1e3`) is
  still read; text that is not a number still stays text.
- **The built-in editor rejects text that is not a number** in a `number` column. It fires
  `validation-error` (`error`: "Enter a number") and keeps the old value, like a validator failure — the
  native input never let such text through, so a text field must not store it.
- The strict-autocomplete error ("Value must be from the existing list") follows the `Locale` (new keys
  `notANumber` and `notInList` in `flexTableLocale`; `ko` built in).

### Changed

- **The `@iyulab/components` peer is `>=1.54.0`** — number parsing uses its `parseNumber`.

- The optional `@lit/react` peer is `^1.0.8` (was `^1.0.0`) — the version the React entry is tested
  with.

### Documentation

- README: the Accessibility section links the KWCAG 2.2 table in `@iyulab/components`.

## [0.40.3] - 2026-09-30

### Fixed

- **Screen readers get the position of a row and a cell in the whole table, not in the rendered part.**
  The grid renders only the visible rows and columns, so without indices a screen reader announced the
  first rendered row as row 1 after scrolling. Rows now carry `aria-rowindex` and cells, column headers
  and footer cells `aria-colindex` (1-based, in display order). `aria-rowcount` now counts the header
  row and the footer row as the ARIA grid pattern defines it (it counted data rows only, so it is one or
  two higher than before). The footer row's cells now have the grid cell role — the footer was a row
  without cells.

## [0.40.2] - 2026-09-30

### Fixed

- **`Locale.set()` from `@iyulab/components` reaches the table again.** The build copied the parts of
  `@iyulab/components` this package uses (`Locale`, number and date formatting, the IME check) into its
  own bundle, so the table kept a separate locale of its own: an app that switched language with
  `Locale.set()` saw the table's menus, labels and formatted values stay in the language detected at
  startup (it matched only when `<html lang>` was already right). `@iyulab/components` is now imported,
  not copied.
- **Copying cells quotes a cell that contains a line break, a tab or a double quote**, so a multi-line
  note pastes into Excel or Google Sheets as one cell instead of splitting into rows. Pasting keeps a
  trailing row of empty cells, which used to be dropped. The clipboard format now comes from
  `@iyulab/components` (`encodeTsv` / `decodeTsv`).

### Changed

- Requires `@iyulab/components` 1.52.0 or later (peer).

## [0.40.1] - 2026-09-30

### Fixed

- **The Enter that finishes an IME composition no longer commits the cell edit and moves down**, and
  no longer jumps to the next match in the find panel. Typing Korean (or another composed language)
  committed the cell before the last syllable was in. Requires `@iyulab/components` 1.51.0 or later.

- **The React wrapper maps every custom event.** `row-reorder`, `column-visibility-change`,
  `comment-change`, `data-import`, `fill-handle-apply`, `find-replace` and `header-context-menu` had no
  `on*` prop; they are now `onRowReorder`, `onColumnVisibilityChange`, `onCommentChange`,
  `onDataImport`, `onFillHandleApply`, `onFindReplace` and `onHeaderContextMenu`.

### Documentation

- README corrected against the source: the `context-menu` detail and that it is cancelable,
  `cell-select` can be `null`, XLSX export, the `footerData` type, and the `format` function's
  arguments.
- The package now ships an agent skill (`skills/iyulab-flex-table/`) — the component API, the React
  wrapper and data-source hooks, and styling in a form coding agents load directly.

## [0.40.0] - 2026-09-28

### Changed

- 🔴 **Breaking — the React hooks moved to `./react`.** `useODataSource` and `useArraySource` (and
  their option/result types) are now exported from `@iyulab/flex-table/react`, next to
  `FlexTableReact`. `./odata` and `./array` keep only the pure functions — `buildSearchExpression`,
  `parseOrderBy`, `computeArrayView`, and the new `buildODataQuery` — and no longer load React, so an
  app without React (a typeahead that is not a table, a Lit app) can use them without installing it.
  Before, importing `buildSearchExpression` from `./odata` required `react` statically.
  Migration: `import { useODataSource } from '@iyulab/flex-table/odata'` →
  `import { useODataSource } from '@iyulab/flex-table/react'` (same for `useArraySource` from
  `./array`).

- 🔴 **Breaking — column definitions use the same words as `u-rich-table`.** `header` → `label` and
  `renderer` → `render`, so one column list reads the same in either table (`header-context-menu`'s detail likewise carries
  `label` instead of `header`). Migration: rename the two keys
  in your `ColumnDefinition` objects; the types reject the old names.
- **Headers follow their values.** A header's default alignment is now the column's cell alignment,
  so a `number` column's header is right-aligned over its right-aligned values instead of sitting
  at the left edge (on a wide column it read as the neighbour's header). Set `headerAlign` to keep
  a different header alignment. Cell alignment uses logical values (`text-align: end`), so
  right-to-left locales mirror.

- **The column menu, the cell context menu and the drag ghost read the shared stacking tokens.**
  The menus sit on `--u-layer-floating` (1000 — they were at 200, below every other floating
  surface) and the drag ghost on `--u-layer-overlay` (9999, as before), so they stack the same way
  as popovers and dialogs from `@iyulab/components`.

### Added

- **`align` on `ColumnDefinition`** (`'start' | 'center' | 'end'`) — cell alignment. Default comes
  from `type` as before (`number` → end, `boolean` → center, otherwise start); set it for a code or
  Y/N column that is text but should center. `effectiveAlign(col)` returns what a column renders with.
- **`buildODataQuery(state)` on `./odata`** — the step `useODataSource` runs on every request (page,
  page size, sort, search, fixed filter → OData query string), now callable without React. A Lit
  table or a non-table list doing server paging can send exactly the query the hook would, instead
  of re-deriving `$top`/`$skip`/`$orderby`/`$search`. The hook now calls it.

## [0.39.0] - 2026-09-27

### Added

- **`enabled` option on `useODataSource`** (default `true`). While `false` the hook makes no
  request and reports `loading: true`; the first request goes out when it turns `true`, with that
  render's conditions. For lists whose query depends on a value that arrives asynchronously (a
  server-decided default filter, the current user, a selected parent): without it the first render
  sent a wasted request with the wrong conditions — often the heaviest one, unfiltered — before the
  real one. Turning it `false` mid-request cancels the request; `refresh()` does nothing while
  disabled.

## [0.38.2] - 2026-09-24

### Fixed

- 🔴 **`useODataSource` no longer drops `@odata.nextLink`.** With server-driven paging, a server
  returns fewer rows than the requested `$top` and a link to the rest. The hook kept only the
  first response, so a table whose `pageSize` exceeded the server's page size showed a short page
  while `totalCount` and the pager still looked right. It now follows the link until the page is
  filled. A link outside the request's origin, or one that returns to a page already read, is
  reported through `error` rather than followed or silently dropped.

## [0.38.1] - 2026-09-23

### Fixed

- 🔴 **XLSX import no longer turns styled numbers into dates.** A number was read as a date whenever
  its cell had any non-default style and its value fell between 1 and 73050 — so bold figures,
  thousands separators, currency and percentage formats (most numbers in a real business
  spreadsheet) came in as dates: a price of 12,450 became `1934-01-30`. Whether a number is a date
  is now decided by the cell style's number format, read from `styles.xml`: the built-in date
  formats, and custom formats whose code draws a day or a year (text in quotes, escaped characters
  and bracketed sections such as `[Red]` or `[$-409]` are not counted). Time-only formats stay
  numbers.
- 🔴 **Imported dates are no longer one day early.** The serial-to-date conversion subtracted a day,
  so a date exported by the table and imported back came in as the day before.
- **Row drag and the fill handle hit the frozen row under the pointer while the table is
  scrolled.** Frozen rows stay put as a sticky band, but both gestures added the scroll offset to
  the pointer position everywhere, so over the band they pointed at the body row hidden behind
  it: a row dropped onto a frozen row landed further down, and a fill dragged up into the band
  stopped short of it. The drop indicator is drawn at the right place too.
- **XLSX import honors the 1904 date system** (`workbookPr date1904`, used by workbooks created on
  a Mac), which otherwise shifts every date by four years.

## [0.38.0] - 2026-09-23

### Fixed

- 🔴 **Cell values follow the app's locale, not the browser's.** The built-in `number`, `date` and
  `datetime` formatting called `toLocaleString()` without a locale, so values followed the runtime
  default while the table's own menus and labels already followed `Locale`. An app set to Korean
  and opened in an English browser showed Korean menus over `9/9/2026, 8:16:01 AM`. Values now go
  through `@iyulab/components`' `formatDate`/`formatNumber`, which use `Locale.get()`, and the
  numeric `format` patterns (`#,##0.00` and friends) use the same locale for their separators.
- **A date-only value such as `"2026-09-09"` is read as that local date.** It was parsed as UTC
  midnight, so in timezones behind UTC a `date` column showed the previous day.

### Changed

- 🔴 **The `@iyulab/components` peer range is now `>=1.27.0`** (was `>=1.24.0`). The formatters come
  from that package's `format` module, which first shipped in 1.27.0; the old range admitted
  versions without it.

⚠ **Visible change:** if your app's `Locale` differs from the browser's language, dates and numbers in
the table now appear in the app's format. Nothing changes when the two agree.

## [0.37.0] - 2026-09-20

### Fixed

- **The column menu and the cell context menu stayed in English on a translated page.** 0.36.0 moved
  the table's chrome text into a locale namespace, but the menus added in 0.35.0 were not part of
  that move: their items, and the accessible name of the column-menu button, were written inline. On
  a Korean page the same button therefore announced one language in its `title` and another in its
  `aria-label`, and a screen-reader user heard English item names in the middle of a translated
  grid — with no way to correct it, since the strings had no keys to register over. Every one of
  those strings now goes through the namespace, including the cell context menu, the two menu
  accessible names and the import drop target. Three keys name a column and carry a `{header}`
  placeholder, so word order stays the translator's choice instead of being fixed by concatenation.
  The built-in English wording is unchanged.

### Documentation

- **The README no longer lists every message key by hand.** That paragraph had gone stale once
  already, and a hand-copied list is the only part of this documentation that can: the exported
  `FlexTableMessageKey` cannot. It now names the groups and points at the type, which your editor
  completes and the compiler checks.

### Added

- **The boolean filter's two options are translatable** (`booleanTrue` / `booleanFalse`). They read
  `True` and `False` in every locale before this; the check and cross glyphs stay in the template,
  since a symbol means the same thing in every language.
- **`t()` and the exported namespace now interpolate.** `FlexTableMessageKey` gains the menu keys
  above; registering a partial table still merges, so existing registrations keep working untouched.

## [0.36.0] - 2026-09-17

### Added

- **The table's own chrome text now goes through a locale namespace.** The filter menus, the
  find-and-replace panel, the column menu and the empty-state message were written in English in the
  source, so an application translated into another language showed thirty-one English strings in
  the middle of its own UI — "Contains", "Starts with", "Match case", "Replace all" and the rest.
  `flexTableLocale` is exported for consumers to register further languages or reword the built-in
  ones:

  ```ts
  import { flexTableLocale } from '@iyulab/flex-table';
  flexTableLocale.register('ja', { contains: '含む', startsWith: '前方一致' });
  ```

  English and Korean ship with the package; other languages are added the same way. The filter
  operators `AND` and `OR`, and the glyphs standing in for icons, are deliberately left alone —
  they read the same in every language and translating them makes them harder to recognise.

### Changed

- The package compiles against `ESNext` rather than `ES2021`, matching every sibling package in the
  same family.
## [0.35.0] - 2026-09-15

### Changed

- **Every header now has a 24×24 column menu button (`⋮`), which replaces the 14px filter button.**
  The menu — the same one a header right-click opens — gathers the per-column actions: **Sort
  ascending** / **Sort descending** (for sortable columns — the keyboard path to sorting), **Filter…**
  and **Clear filter** (with `show-filters`), **Hide column** / **Show: …**, **Auto-fit width**,
  **Wider** and **Narrower** (±20px, the menu stays open for repeated steps). Opening a filter is now
  two clicks. The button is highlighted while its column is filtered, as the filter button was.
  The old filter button was below the WCAG 2.2 SC 2.5.8 minimum and sat right next to the resize handle;
  the handle keeps its 6px width and the column menu is its equivalent, which also means resizing
  no longer requires a drag (SC 2.5.7).

### Fixed

- **Sorting from the cell context menu broke the `sort-change` contract.** It reported
  `{ sortCriteria }` instead of `{ criteria }`, re-sorted the data locally even with
  `data-mode="server"`, and ignored `sortable: false`. It now behaves exactly like a header click.
- **The header and cell context menus could not be used from the keyboard, and could open
  off-screen.** Their items are now buttons in a `role="menu"`: arrow keys, Home and End move between
  them, Escape closes and returns focus (to the column menu button, or to the grid). The cell menu
  focuses its first item when it opens. Both menus are moved back inside the visible area once their
  real size is known — the cell menu previously flipped on a guessed 200×280 size, and a menu fitted
  to the window width could still sit under the vertical scrollbar.

## [0.34.3] - 2026-09-13

### Fixed

- **The "host has no height constraint" dev-mode warning was a complete no-op in every published
  release** — the guard used `import.meta.env.DEV`, which Vite resolves statically at this
  package's own build time, so the published dist always shipped with the check baked to `false`
  and the warning body removed entirely by dead-code elimination. Replaced with
  `process.env.NODE_ENV !== 'production'`, which survives this package's own build and is resolved
  by each consumer's own bundler against its own dev/production build (see `@iyulab/components`
  1.40.3, which had the identical defect in its shared dev-warning helper).

## [0.34.2] - 2026-09-13

### Added

- **Development-mode warning when virtual scrolling is silently off.** With 200 or more rows and no
  height constraint the host grows to fit every row, nothing scrolls, and every row is rendered —
  the state the README's "100,000+ rows" premise does not cover. The grid now says so once
  (`[@iyulab/flex-table]`, development builds only) and tells you to size the host so it becomes
  the scroll container.

## [0.34.1] - 2026-09-10

### Changed

- **Fallback literals for `--u-txt-color-weak` follow `@iyulab/components` 1.40.0.** They are
  only used when that stylesheet is not loaded; with it, nothing changes here.

### Fixed

- **A column pinned to the right was placed against the scrolled content instead of the
  viewport, so it sat outside the visible area exactly when a pin is needed.** Cells are
  positioned absolutely inside a box as wide as the whole row, so the emitted
  `right: ${-scrollLeft + offset}` measured from the content's right edge rather than the
  viewport's: at `scrollLeft: 0` the column rendered past the right border of the scroll area
  and never came into view. The negative offset also pushed the cell beyond that box, which
  extended the scrollable width — measured in Chromium, `scrollWidth` grew 968 -> 1160 -> 1543
  across three scroll steps, so the horizontal scrollbar could not reach its own end.

  Right pins are now expressed the same way left pins already were, as a `left` offset that
  tracks the viewport, clamped to the column's natural position. A right-pinned column stays
  against the right edge of the scroll area at every scroll offset, several of them stack in
  column order, and a table whose columns fit without overflowing leaves the column where it
  naturally sits rather than inventing a scrollable area. Header, body and footer cells all
  take the same path.

  `position: sticky` — the usual way to build a pinned column — is not available in this
  layout: every cell is absolutely positioned for horizontal virtualization, and a sticky box
  needs a flow position to stick relative to.

## [0.34.0] - 2026-09-08

### Fixed

- **Three type errors in the export/import path that the toolchain was hiding.** This package
  pinned TypeScript at `~5.7.0` — a value carried over from its initial commit and never
  revisited — while every sibling package compiled with `^5.9.3`. Aligning the pin surfaced
  errors that had been present but unreported: `Uint8Array` widens to
  `Uint8Array<ArrayBufferLike>`, which the DOM lib rejects wherever an `ArrayBuffer` is
  required (`BlobPart`, `BufferSource`). The XLSX writer/reader and the download helper now
  carry the concrete `Uint8Array<ArrayBuffer>` through, so a `Blob`/`File` built from an export
  typechecks. Runtime behaviour is unchanged — the values were always backed by a real
  `ArrayBuffer`.

### Changed

- **`exportToString()` and `downloadFile()` now declare `Uint8Array<ArrayBuffer>`** instead of
  the wider `Uint8Array`. Callers that pass the result straight to `Blob`/`File` — the
  documented use — are unaffected and now typecheck without a cast. Only a caller that
  deliberately supplied a `SharedArrayBuffer`-backed view is affected, and such a value could
  never have reached `Blob` at runtime anyway.

- **`typescript` devDependency `~5.7.0` → `^5.9.3`**, matching every sibling package.

## [0.33.0] - 2026-09-08

### Fixed

- **A page could outlive the result set that holds it, leaving an empty table next
  to a non-zero total and a pager pointing at a page that no longer exists.**
  Three axes change the size of a result set, and only two of them moved the page.

  - **`useODataSource`: changing `fixedFilter` now resets the page to `0`**, the
    same way `setSearch` and `onSortChange` already did. Narrowing a filter while
    on page 5 previously kept the old `$skip` and asked for a range the new set
    does not have. Comparison is by value, so passing a fresh object literal on
    every render does not reset anything on its own, and the reset does not run on
    mount, so it never overrides `initialPage`.
  - **`useODataSource`: a response reporting fewer rows than the current page needs
    falls back to the last page that exists.** A result set can shrink without
    being asked. Reaching that state costs one extra request, only in that case;
    the page only ever moves down, so it cannot loop.
  - **`useArraySource`: paging is clamped to the array passed in.** Shrinking the
    array — the in-memory equivalent of narrowing a filter — falls back to the last
    page that exists instead of rendering nothing.

  Shrinking clamps rather than resets on purpose: an array or a total can change on
  a routine refresh, and resetting there would move the page out from under the
  reader. The dividing question is whether the change was asked for.

### Changed

- **`computeArrayView` returns the last page that exists when given a page past the
  end**, instead of an empty array. It is exported, so a direct caller had the same
  defect; returning nothing for an out-of-range page was never the intended
  contract.

### Internal

- First hook tests for this package — everything here was pure functions until now,
  so contracts the README states had no executed evidence behind them. They cover
  the reset and clamp on both hooks, request abort on re-request and on unmount,
  `onUnauthorized` firing on `401`/`403` but not on `500`, initial state being read
  on first render only, and `refresh` being a no-op on the array source.

## [0.32.0] - 2026-09-08

### Added

- **Both source hooks accept their initial page, search term and sort.**
  `useODataSource` and `useArraySource` now take `initialPage` (zero-based, the same
  axis as the returned `page`/`setPage`), `initialSearch` and `initialSort`. They are
  read on the first render only — the same contract `defaultOrderBy` has always had —
  and every default matches today's behaviour exactly, so existing callers are
  unaffected.

  Restoring a list the way the user left it — returning from a detail screen, or
  restoring from a URL — was previously only expressible as a mount effect calling
  `setPage()` after the hook had already fetched page 0. That shape carries two problems
  a caller cannot solve from outside: the first request is issued and then discarded,
  and `setSearch()` resets the page by design, so "restore the page, then set the search
  term" has no ordering that works.

  `initialSort` takes precedence over `defaultOrderBy` — the two express the same thing
  in different notations, and the array form is the shape `onSortChange` hands back, so a
  stored sort round-trips without being re-serialized. An empty `initialSort: []` means
  *no sort* and does not fall back to `defaultOrderBy`.

### Internal

- Both hooks now resolve their initial state through one shared function rather than two
  copies, so the two sources cannot drift apart on the shape the README declares they
  share.

## [0.31.5] - 2026-09-04

### Fixed

- **`0.31.3` and `0.31.4` both failed to reach npm for the same reason**: the
  publish and demo-deploy workflows pinned Node 22, and npm's dependency
  resolver crashes with a null-pointer error during a lockfile-less install
  on that runner (this repo doesn't commit a `package-lock.json`) — the CI
  workflow, which already runs Node 24, never hit it. Both workflows now run
  Node 24 to match CI. No package code changed; this release exists to get
  `0.31.3`'s content onto the registry with a working pipeline.

## [0.31.4] - 2026-09-04

### Fixed

- **`0.31.3`'s release pipeline never actually published to npm** — the
  publish step's `npm install` crashed with a null-pointer error inside
  npm's own dependency-resolution engine, unrelated to this package's
  dependency graph (the lockfile is byte-for-byte unchanged from the prior,
  successfully published `0.31.2`, and two separate retries reproduced the
  identical crash). No package code changed; this release exists to get
  `0.31.3`'s content onto the registry with a working pipeline.

## [0.31.3] - 2026-09-04

### Fixed

- **Header resize/reorder drag and row-number drag reorder could spuriously
  toggle column sort or extend row selection on drop.** A native `click`
  event the browser synthesizes after `mouseup` bubbles to the header
  cell's own sort listener (or the row-number cell's select listener)
  even though `stopPropagation()` on the drag handle's `mousedown` had
  already fired — that call only blocks the `mousedown` itself, not the
  separate `click` that follows. Both interactions now track whether the
  gesture that just ended was a genuine resize/drag and skip the next
  click when it was.

## [0.31.2] - 2026-09-02

### Fixed

- **`ColumnDefinition`'s README reference was missing three real, shipped
  fields**: `headerAlign` (per-column header alignment, added in a later
  commit than the rest of the snippet), `options`/`autocomplete` (select-type
  columns and autocomplete editing, since `0.13.0`). The `select` value of
  `ColumnType` was also missing from its inline comment. None of these had
  any mention anywhere in the README — a consumer had no way to discover
  select columns or autocomplete existed short of reading the source.

## [0.31.1] - 2026-09-01

### Fixed

- **`0.31.0`'s release pipeline never actually published to npm** — the repo's
  `preversion` guard script assumed a monorepo layout this repo doesn't have,
  so the workflow's own version-sync step failed before publishing. No package
  code changed; this release exists to get `0.31.0`'s content onto the
  registry with a working pipeline.

## [0.31.0] - 2026-08-31

### Added

- **`useArraySource`, a client-array sibling to `useODataSource`.** `useODataSource`
  is server-mode only, so a lookup table needing a client-side join (a display
  field living on a different endpoint than the row) had no library-level path
  and required reimplementing filter/sort/pagination by hand. `useArraySource`
  returns the exact same shape (`data`/`totalCount`/`loading`/`error`/`page`/
  `setPage`/`sortCriteria`/`onSortChange`/`search`/`setSearch`/`refresh`) driven
  off a local array instead of a fetch, so the same `<FlexTableReact
  dataMode="server" ...>` binding code works with either source. Sorting reuses
  the grid's own `computeSortedIndices` for value-aware (not string) comparison.
  New `./array` subpath export, mirroring `./odata`'s shape.

## [0.30.0] - 2026-08-28

### Added

- **`buildSearchExpression` and `parseOrderBy` are now exported from
  `./odata`.** Both were already implemented as pure, tested functions used
  internally by `useODataSource`, but the public barrel only re-exported
  the hook itself. A consumer needing the same `$search`/`$orderby`
  encoding without the pagination hook (a typeahead, a standalone sort
  control) had to reimplement the OData 4.0 search-quoting workaround
  from scratch.

## [0.29.0] - 2026-08-28

### Added

- **`row-activate` event, fired on Enter for a non-editable cell.** The internal
  keydown handler always consumed Enter/F2 regardless of a column's editability,
  so a host attaching its own `keydown` listener to the grid had no reliable way
  to react to Enter in a read-only grid (registration order dependent). Enter on
  a non-editable cell now dispatches `row-activate` (`{ row, index, col, key }`)
  instead of attempting to start an edit — mirroring the existing `row-add`/
  `row-delete` detail shape. F2 is unaffected (edit-only key). Mapped through to
  the React wrapper as `onRowActivate`.

## [0.28.0] - 2026-08-23

### Added

- **`stylesheets: CSSStyleSheet[]`** — constructable stylesheets adopted into the grid's shadow
  root alongside its own styles. A `ColumnDefinition.renderer` returns content that's inserted
  inside `<flex-table>`'s shadow root, so a class-based utility from the host document's CSS
  (`.is-xs`, a design-system size variant, anything selector-based rather than a CSS custom
  property) never reaches it — the class attaches but no rule matches, since document stylesheets
  don't cross the shadow boundary. Passing the same `CSSStyleSheet` the host document already
  uses (`document.adoptedStyleSheets`) into this new property closes that gap without copying
  CSS or reaching into internals. Reassigning `stylesheets` swaps the previously-adopted sheets
  for the new ones — it doesn't accumulate — and the grid's own styles are never affected either
  way.

## [0.27.0] - 2026-08-23

### Added

- **Shift-click range selection on the row checkbox column** (`selectable` + `selectionMode:
  'multi'`). Clicking a row's checkbox while holding Shift now selects every row between it and
  the last row you clicked, matching the row-selection convention used by spreadsheets and file
  managers. A plain click still just toggles the one row it lands on, and the anchor resets to
  whichever row you last clicked (shift or not) — the same rules as native cell selection already
  followed elsewhere in the grid.
- **`selectWhere(predicate)`** — selects every currently-loaded row for which `predicate(row,
  dataIndex)` returns true, added to whatever is already selected (call `deselectAll()` first for
  a fresh set). Built for "the user pastes a list of keys, select the matching rows" flows: the
  host doesn't need to reason about visual-vs-data row indices or virtualization — it gets the
  same row objects `data` was set with.
- **`emptyMessage` / `noMatchingMessage`** — the text shown in the empty state (`data` is empty,
  or every row is hidden by an active column filter) was previously hardcoded to `'No data'` /
  `'No matching data'` with no way to override it. Any consumer localizing their UI, or wanting a
  more specific message ("no orders yet — create one"), had to reimplement the empty state
  themselves. Both now default to the same English strings for backward compatibility, and can be
  overridden as string properties/attributes (`empty-message`, `no-matching-message`).

## [0.26.0] - 2026-08-20

### Added

- **`ColumnDefinition.headerAlign`** (`'start' | 'center' | 'end'`, default `'start'`). Header
  label alignment was previously fixed to the left regardless of how the column's own content is
  rendered. A column whose `renderer` centers its content (an icon-only action column, for
  example) had no way to make the header label match, so the two visually drifted apart. Setting
  `headerAlign: 'center'` (or `'end'`) aligns the header text independently of cell content
  alignment, which the consumer already fully controls via `renderer`.

## [0.25.0] - 2026-08-07

### Added

- **`--ft-font-size` now reads `var(--u-density, 14px)`.** When a consumer sets the design
  system's `--u-density` switch on an ancestor, the table's base font size (and everything
  derived from it) follows automatically. Unset, behavior is unchanged.

### Fixed

- **Hovering an odd (striped) row produced no visible feedback in dark mode.** Odd rows sit on
  the raised-surface background, and the hover style used the same global hover token that raised
  happened to equal in dark — so the row simply didn't respond. Odd-row hover now reads a
  dedicated raised-surface hover token when the design system sheet provides one, falling back to
  the previous behavior otherwise. Even rows are unaffected.

## [0.24.0] - 2026-08-05

### Changed

- ⚠**`@iyulab/components` is now a required peer dependency (`>=1.24.0`).** The
  stylesheet is not decoration here — 313 token references depend on it, and without
  it the fallback literals silently stand in for the real theme. Declaring the peer as
  optional would keep allowing exactly the situation the fallbacks were meant to reveal.

  Consumers pinned to `@iyulab/components@1.23.x` will see an `ERESOLVE` on install.

### Fixed

- **`sideEffects` no longer misses the shared chunk.** With more than one entry point,
  the bundler splits common code — including the custom-element registrations — into a
  hash-named chunk. The declaration listed only the named entries, so a consumer's
  bundler could drop that chunk and the elements would never register, with no error at
  build time. It now covers the emitted output as a whole (`./dist/*.js`), which is
  hash-stable across builds.

- **The `./react` and `./odata` subpaths point back at the built output.** They had been
  rewritten to source paths, which do not exist in the published package.

## [0.23.2] - 2026-08-04

### Changed

- **OData 요청 실패 기본 문구가 영어가 된다** — `요청 실패 (500)` → `Request failed (500)`.
  서버가 오류 메시지를 주면 **그쪽이 이긴다**(종전과 같다) — 이 문구는 서버가 아무것도 주지
  않을 때의 폴백이다.

  ⚠**로케일 레지스트리를 도입하지 않았다.** 문자열 하나를 위해 런타임 의존을 들이는 것은
  비용이 이득을 넘는다(이 패키지의 의존은 `lit` · `odata-query` 둘뿐이다). 수요가 모이면 그때
  같은 형태로 연다.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.23.1] - 2026-08-03

### Fixed

- 🔴**토큰 폴백 리터럴 48곳이 디자인 시스템 값이 아니었다.** `var(--u-토큰, #리터럴)` 의
  리터럴은 **정의상 시트 값의 복제**이고, 시트를 로드하지 않은 소비자가 실제로 보는
  값이다. 그런데 이 표의 48곳은 낡은 것이 아니라 **처음부터 다른 팔레트**였다.

  ```
  --u-primary-color     #1a73e8 → #1976D2   (7곳)
  --u-txt-color         #202124 → #212121   (6곳)
  --u-bg-color-raised   #f8f9fa → #FAFAFA   (6곳)
  --u-txt-color-weak    #5f6368 → #757575   (6곳)
  --u-bg-color-active   #e8eaed → #EEEEEE   (3곳)   … 외 7종
  ```

  ⚠**시트를 로드하는 소비자에게는 변화가 없다** — 폴백은 그 경우 아예 평가되지 않는다.
  **시트 없이 쓰던 소비자**는 표의 색이 디자인 시스템 기본값으로 바뀐 것을 본다. 그것이
  이 폴백이 원래 뜻하던 값이다.

  ⚠**개발 환경에서는 드러날 수 없는 부류의 결함이다.** 시트가 있으면 폴백은 평가되지
  않으므로, 어긋난 값은 *우리가 보지 못하는 화면*에서만 나타난다.

## [0.23.0] - 2026-08-03

### Added

- ★**표의 밀도와 머리행 위계를 조절할 수 있다.** 색은 0.22.0 에서 열렸지만 **치수는 닫혀
  있었다** — 한 화면에 이 표와 다른 표가 함께 놓이는 경우, 소비자는 색만 맞추고 밀도·위계는
  맞추지 못했다. 그리고 *"고칠 수 있는 쪽만 고치면 더 갈라지므로"* 실제로는 **양쪽 다
  포기하는** 선택으로 밀린다.

  ```
  --ft-row-height           32px   행 높이
  --ft-cell-padding-block    6px   그 높이 안에서 글자의 자리
  --ft-cell-padding-inline  12px
  --ft-header-font-size            기본값 = --ft-font-size
  --ft-header-font-weight    600
  ```

  **기본값이 종전 렌더값과 같다** — 아무것도 선언하지 않은 소비자의 화면은 바뀌지 않는다.

  ⚠**`--ft-row-height` 만 성질이 다르다.** 이 표는 가상 스크롤이라 행이 `index × rowHeight`
  로 절대 배치되고 셀 높이가 인라인으로 박힌다 — ***행 높이는 캐스케이드로 닿지 않는다.***
  그래서 이 토큰은 **첫 렌더에 한 번 판독**되어 가상화 계산에 들어간다. 이후에 바꾸려면
  `rowHeight` 프로퍼티(또는 `row-height` 속성)를 쓴다. 명시 지정은 **항상 토큰을 이기고**,
  `px` 이외 단위는 무시된다.

  ⚠**행 높이는 고정이고 여백은 그 안에서 글자를 배치한다.** 셀은 설계상 한 줄이다
  (`nowrap` + 말줄임). 행 높이를 줄이면 여백도 함께 줄일 것 —
  `padding-block × 2 + 한 줄 높이 ≤ row-height` 를 넘으면 아래가 잘린다.

## [0.22.0] - 2026-08-03

### Changed

- ★**표 색이 `@iyulab/components` 디자인 토큰에서 파생한다.**

  종전에는 자체 팔레트를 리터럴로 갖고 있어, 소비자가 셸·버튼의 브랜드를 맞춰도
  **표만 다른 색 체계**로 남았다. 업무앱에서 표는 화면 면적의 대부분이라 나머지를
  아무리 맞춰도 체감이 바뀌지 않는다. 이제 `--u-primary-color` 한 줄로 표의 강조색·
  선택 표시·불리언 표시가 함께 따라온다.

  ```
  --ft-active-color      → --u-primary-color        (강조 · 정렬 활성 · 포커스)
  --ft-selection-bg      → --u-primary-bg-color     (선택된 셀/행)
  --ft-bg / -row-even-bg → --u-bg-color
  --ft-header-bg         → --u-bg-color-raised      (크롬 면)
  --ft-row-hover-bg      → --u-bg-color-hover
  --ft-text-color        → --u-txt-color
  --ft-border-color      → --u-border-color
  --ft-sort-…/-empty-…   → --u-txt-color-weak
  --ft-editor-bg         → --u-input-bg-color
  ```

  ⚠**의존성이 늘지 않는다.** CSS 커스텀 프로퍼티 참조는 `import` 를 만들지 않는다 —
  `package.json` 은 그대로다.

  ⚠**시트 없는 독립 사용은 종전과 같다.** 모든 참조가 리터럴 폴백을 갖고 다크 블록도
  남아 있어, 토큰 시트를 로드하지 않으면 예전 색·예전 자동 다크로 렌더된다.
  회귀 테스트가 이 둘을 함께 지킨다.

  **소비자 영향**: 토큰 시트를 쓰는 앱에서는 **표 색이 바뀐다** — Google 계열
  (`#1a73e8` 등)에서 디자인 시스템 팔레트로 이동한다. 종전 색을 유지하려면 `--ft-*` 를
  직접 지정하면 된다(그 경로는 그대로다).

### Fixed

- **상태 색이 규칙 안에 박혀 있어 덮을 수 없고 테마를 몰랐다** — 무효 셀, 드롭 표시,
  찾기 강조가 리터럴이라 다크에서도 라이트 값 그대로였다. `--ft-invalid-*`·`--ft-drop-*`·
  `--ft-find-*` 로 열고 상태 색에서 알파를 뽑는다.

  ★**면 토큰이 아니라 알파 파생인 이유**: 이 배경들은 불투명 면이 아니라 **겹침**이다 —
  줄무늬(홀/짝 행)와 선택 표시가 아래에서 비쳐야 "어느 행의 어떤 셀"인지 읽힌다.
  부수 효과로 두 테마 모두에서 성립한다.

- **댓글 입력 포커스 링이 팔레트에 없는 색이었다**(`rgba(59,130,246,.2)` — Tailwind
  blue-500). 바로 옆 줄의 테두리는 `--ft-active-color` 를 쓰고 있어 **두 색이 서로 달랐다.**

## [0.21.1] - 2026-08-02

### Fixed

- **빈 셀 문구가 라이트 테마에서 WCAG AA 에 미달하던 문제.** `--ft-empty-color` 가 `#999`
  로 흰 바탕 대비 **2.85** 였다(AA 기준 4.5). 정렬 표시와 같은 회색인 `#5f6368`(**6.05**)로
  맞췄다 — 팔레트를 한 계열로 유지한다.

  다크 값(`#9aa0a6` on `#1e1e2e` = 6.31)은 원래 정상이었으므로 손대지 않았다.
  **라이트 한쪽만의 결함**이었다.

### Known issues

- `--ft-border-color` 가 바탕 대비 **1.32**(라이트) · **1.59**(다크)로 WCAG 1.4.11(3.0)에
  미달한다. 표 격자선을 "UI 컴포넌트 경계"로 볼지가 판단을 요구하고, 값을 올리면 표의
  시각 무게가 크게 바뀌므로 이번에 손대지 않았다. 나머지 조합(본문·헤더·선택행·호버행·
  활성색·불리언 표시)은 두 테마 모두 통과한다.

## [0.21.0] - 2026-07-17

### Fixed
- `useODataSource`: 검색어를 인용 없이 `$search`로 전송해 **숫자·하이픈이 포함된 검색어가 전부 400**으로 거부되던 결함 수정. 이제 공백으로 나눈 토큰을 각각 인용된 phrase로 감싸 `AND`로 결합해 전송한다 (`red shirt` → `$search="red" AND "shirt"`). 실사용에서 관측(상품코드·주문번호·연도처럼 숫자·하이픈을 포함한 검색이 전부 무응답).
  - **원인은 문법 제약이 아니라 버전 스큐**: OData 4.0의 `searchWord`는 문자(Unicode L/Nl)만 허용하나, 4.01은 `searchChar`(`unreserved` 포함 — 숫자·`-`·`.`·`_`·`~`)로 완화했다. Microsoft.OData 렉서가 아직 4.0 규칙이라 `2026`·`ZT-E2E-A`를 거부한다([odata.net#2445](https://github.com/OData/odata.net/issues/2445), OPEN). `searchPhrase`는 4.0·4.01 양쪽에서 적법해 서버 버전과 무관하게 안전하다.
  - **통째가 아니라 토큰별로 감싸는 이유**: 인용 없는 다중 단어는 암묵 AND로 파싱된다(`searchAndExpr = RWS [ 'AND' RWS ] searchExpr`). 전체를 한 phrase로 감싸면 연속 문자열 매칭으로 의미가 바뀌므로, 토큰별 인용이 기존 의미론을 보존한다.
  - `"`는 phrase에 담을 수 없고 OData가 이스케이프를 정의하지 않아 검색어에서 제거한다. 공백뿐인 검색어는 `$search`를 붙이지 않는다.
  - **거동 변경 주의**: 단일 토큰도 word에서 phrase로 바뀐다. `$search`의 매칭 정의는 스펙상 implementation-specific이라 서버에 따라 결과가 달라질 수 있어 patch가 아닌 minor로 올린다.
- `eslint.config.js`에 `eslint-plugin-react-hooks`가 등록된 적이 없는데 `use-odata-source.ts`가 `react-hooks/exhaustive-deps` disable 지시자를 사용해 **`npm run lint`가 계속 exit 1**이던 결함 수정. 존재하지 않는 규칙을 가리키는 고아 지시자를 제거하고 deps가 부분집합인 이유는 산문 주석으로 보존했다.

### Added
- `src/odata/` 단위 테스트 신설(11건) — 이 디렉터리는 테스트가 전무했고, 그것이 위 `$search` 결함이 배포된 원인이다. `$search` 쿼리 문자열을 `odata-query` 통합까지 포함해 검증한다.

### Documentation
- README `OData Source Hook`: **반환값 표 신설**. 기존엔 옵션만 문서화되어 `setSearch`·`error` 등 반환 필드의 계약을 알 수 없었다. `error`는 렌더하지 않으면 실패한 요청이 그리드를 조용히 비운다는 점을 명시.
- README `Search semantics` 신설: `setSearch`가 OData 검색 표현식이 아닌 **리터럴 텍스트**를 받는다는 계약과 인용 근거를 문서화.

## [0.20.1] - 2026-07-03

### Fixed
- `FlexTable`: `clearSelectionOnDataChange` 활성화 시 React 래퍼(`FlexTableReact`, `@lit/react`) 경유하면 체크박스 행 선택 자체가 불가능하던 결함 수정. `@lit/react`가 dirty-check 없이 매 렌더마다 `.data`를 재대입하는데, `set data()`가 참조 동일성 비교 없이 무조건 `deselectAll()`을 호출해 "선택 → setState → 리렌더 → data 재대입 → 선택 해제" 루프가 발생했다. 이제 `set data()`는 참조가 실제로 바뀐(외부 교체) 경우에만 선택 해제/undo 클리어 side-effect를 실행한다(`clearUndoOnDataChange`도 동일 가드 적용). 동일 참조 재대입에도 `hasChanged: () => true`에 의한 in-place 리렌더는 유지된다. 실사용에서 관측(기존 우회: `gridKey` remount).

## [0.20.0] - 2026-07-02

### Added
- `FlexTable`/`FlexTableReact`: `loading?: boolean` prop 추가. `true`일 때 그리드 위에 내장 오버레이를 표시하고 host에 `aria-busy="true"`를 반영한다. `useODataSource()`가 반환하는 `loading`과 자연 연동(`<FlexTableReact loading={source.loading} .../>`). 이전에는 각 소비 페이지가 `style={{opacity: loading ? 0.6 : 1}}` 같은 인라인 opacity 해킹으로 우회하고 있었다.

## [0.19.1] - 2026-07-02

### Documentation
- README: `format` vs `renderer` 가이드 추가 — `ColumnDefinition.format`이 인터페이스 표에서 누락되어 있었고, 두 옵션의 차이(원본 값 유지 vs 렌더 전체 대체)와 우선순위(`renderer` > `format`)가 문서화되어 있지 않았음
- README: React `ref` 명령형 API 사용 예시 추가 — `FlexTableReact`가 `ref`를 내부 `FlexTable` 엘리먼트로 포워딩해 `addRow`/`deleteRows`/`selectAll` 등 [Methods](#methods)를 리렌더 없이 호출 가능함을 명시

## [0.19.0] - 2026-07-02

### Added
- `useODataSource`: `fetcher`(커스텀 transport), `baseUrl`(origin override), `onUnauthorized`(401/403 콜백) 옵션 추가
  - 기본값은 기존 동작(전역 `fetch` + `window.location.origin`)과 동일 — 하위 호환
  - 소비 앱이 인증 헤더 주입·세션 만료 처리를 `HttpClient` 등 자체 transport로 일원화 가능 (전역 `window.fetch` 몽키패치 우회 불필요)
- `ColumnDefinition<T>`/`CellRenderer<T>`/`CellEditor<T>`/`CellValidator<T>`/`ConditionalRule<T>` 제네릭화, `FlexTableReact<T>` React 래퍼 제네릭 지원
  - 기본값 `T = DataRow`로 기존(비제네릭) 사용 100% 하위 호환. `<FlexTableReact<Order> data={orders} columns={columns} />`처럼 실제 행 타입을 지정하면 `renderer`/`editor`/`validator`/`format` 콜백까지 타입 추론됨 — 소비 측 `as unknown as` 캐스트 불필요
  - 내부 커스텀 엘리먼트(`FlexTable`)는 DOM 특성상 인스턴스별 제네릭이 불가능하므로 계속 `DataRow` 기반으로 동작 — 캐스트는 `FlexTableReact` 경계에서 라이브러리가 1회 수행(소비자에게는 보이지 않음)
- `clearSelectionOnDataChange` 속성(`clear-selection-on-data-change`) 추가 — 활성화 시 `data`가 외부에서 교체될 때 행 선택(체크박스)을 자동 해제하고 빈 선택으로 `selection-change`를 재발화
  - 기본값 `false`(기존 `clearUndoOnDataChange`와 동일 컨벤션) — 하위 호환
  - **안전 목적**: 행 선택은 인덱스 기반이라, `data`가 동일 길이의 다른 행으로 교체돼도 선택 상태가 그대로 남아 잘못된 행에 일괄 작업(상태전이/입금 등)이 적용될 위험이 있음. 선택이 벌크 액션을 구동하는 `selectable` 그리드(특히 서버 모드 + `useODataSource` 조합)에는 이 옵션 활성화를 권장

## [0.18.0] - 2026-05-19

### Added
- **셀 코멘트 편집 팝업**: 우클릭 컨텍스트 메뉴에서 코멘트를 직접 편집
  - 코멘트 없는 셀: "Add Comment" 메뉴 항목 표시
  - 코멘트 있는 셀: "Edit Comment" + "Delete Comment" 메뉴 항목 표시
  - 편집 팝업: textarea + Cancel/Save 버튼
  - 단축키: Ctrl+Enter 저장, Escape 취소
  - 팝업 외부 클릭 시 자동 저장
  - 편집 결과는 `setComment()` API와 동일하게 undo/redo 연동

## [0.17.0] - 2026-05-19

### Added
- **Undo/Redo 갭 보완**: 주요 API에 undo/redo 지원 추가
  - `importFromFile()` undo/redo 지원 — import 전 데이터 상태로 복원 가능
  - `setComment()` undo/redo 지원 — 이전 코멘트 상태로 복원 가능
  - `clearComments()` undo 지원 — 전체 코멘트 복원 가능
  - `hideColumn()` / `showColumn()` undo/redo 지원 — 컬럼 가시성 복원 가능
  - **Ctrl+Y** Redo 단축키 (Excel/브라우저 표준)
- **공개 API**: `undo()`, `redo()`, `clearUndoHistory()` 메서드 추가
  - 외부 툴바/버튼에서 직접 호출 가능
- **`clear-undo-on-data-change`** 속성 (`clearUndoOnDataChange: boolean`, 기본값: `false`)
  - `true`로 설정 시 외부에서 `table.data = ...`를 통해 데이터를 교체하면 undo/redo 히스토리 자동 clear
  - 내부 undo/redo 동작은 영향받지 않음

### Internal
- `_applyComment()` 내부 메서드 분리 (undo/redo 재귀 호출 방지)
- `_inUndoRedo: boolean` 플래그로 내부 undo/redo 경로 식별 (`clearUndoOnDataChange` 연동)
- `data` 속성을 getter/setter 패턴으로 전환 (backing field `_data`, Lit reactive property 유지)
- 키보드 핸들러(Ctrl+Z/Y)가 공개 `undo()`/`redo()` 메서드를 재사용 (DRY)

## [0.16.1] - 2026-05-19

### Fixed
- Fill handle position offset: `_colLeftOffsets` already includes `_prefixWidth`, but `_renderFillHandle` and `_renderFillPreview` were adding it again, causing the handle to appear displaced to the right (especially noticeable with row numbers or checkbox columns enabled)

## [0.16.0] - 2026-05-19

### Added
- **XLSX Import**: `.xlsx` 및 `.csv` 파일을 테이블에 가져오기
  - `importFromFile(file: File): Promise<void>` API
  - `import-enabled` 속성으로 드래그&드롭 활성화 (파일 드롭 오버레이 포함)
  - 첫 행 헤더 → 기존 컬럼 key 자동 매칭 (exact 우선, 대소문자 무관 fallback)
  - 컬럼 타입에 따라 자동 형 변환 (number, boolean, text)
  - `data-import` CustomEvent (`detail.count`: 가져온 행 수)
  - 외부 의존성 없는 순수 TypeScript 구현 (ZIP 중앙 디렉터리 파싱, OOXML DOMParser, DEFLATE/STORE 지원)
- **셀 코멘트**: 셀 단위 메모/코멘트 부착
  - `setComment(dataIndex, colKey, text|null)` API — 빈 문자열/null 전달 시 제거
  - `getComment(dataIndex, colKey)` API
  - `getAllComments()` — 전체 코멘트 배열 반환
  - `clearComments()` — 전체 코멘트 삭제
  - `comment-change` CustomEvent (`detail: { dataIndex, colKey, text }`)
  - 코멘트 있는 셀 우상단에 오렌지색 삼각형 인디케이터 표시, hover 시 title tooltip

### Internal
- `src/export/xlsx-reader.ts`: ZIP 리더 + OOXML 파서 (shared strings, 셀 타입 처리, 날짜 시리얼 변환)
- `_comments: Map<number, Map<string, string>>` 내부 저장소 (dataIndex → colKey → text)
- `_applyImportedSheet`, `_applyImportedRows`, `_buildHeaderColumnMap` 내부 메서드
- `_onDragover`, `_onDragleave`, `_onDrop` 드래그&드롭 핸들러
- `.ft-import-overlay`, `.ft-has-comment`, `.ft-comment-indicator` 스타일 추가

## [0.15.0] - 2026-05-19

### Added
- **고급 필터 — 텍스트 모드**: 필터 드롭다운에 모드 셀렉터 추가 (`contains` / `starts with` / `ends with` / `wildcard`). 와일드카드는 `*`(임의 문자열), `?`(단일 문자) 지원
- **고급 필터 — 빈 셀 필터**: 모든 컬럼 타입 (text/number/date/boolean)에 "Empty only" / "Non-empty only" 옵션 추가. 텍스트 입력 시 자동 해제
- **고급 필터 — 숫자 2조건 AND/OR**: 숫자 필터가 `=`, `≠`, `>`, `<`, `≥`, `≤` 연산자 선택 + 2개 조건 AND/OR 결합으로 대체. 단일 조건만 설정해도 동작
- **행 고정 (`frozen-rows`)**: `frozenRows: number` 속성으로 상단 N행 고정. 세로 스크롤 중 항상 표시. 편집 가능, 핀 컬럼과 올바르게 교차 렌더링, `position: sticky` 기반

### Changed
- 숫자 필터 UI: 기존 Min/Max 범위 입력 → 연산자 선택 + 2조건 AND/OR UI로 교체
- 필터 드롭다운 최소 너비 160px → 200px

### Internal
- `TextFilterMode` 타입 추가 (`contains` | `starts` | `ends` | `wildcard`)
- `NumericOp`, `NumCondition`, `NumberAdvState` 타입 추가
- `_buildTextPredicate`, `_buildNumberPredicate`, `_buildDatePredicate`, `_buildEmptyPredicate` predicate 빌더 메서드 추가
- `_applyFilterForKey`: 필터 재적용 단일 진입점으로 리팩터링
- `_frozenRowCount`, `frozenRowsHeight` getter 추가
- `_renderFrozenRows`: sticky 컨테이너에 frozen rows 렌더링

## [0.14.0] - 2026-05-19

### Added
- **내장 컨텍스트 메뉴 (`show-context-menu`)**: 셀 우클릭 시 기본 메뉴 표시 (복사, 행 삽입·삭제, 컬럼 숨기기, 정렬, 필터)
  - `context-menu` 이벤트에서 `preventDefault()` 호출 시 내장 메뉴 억제
  - 화면 경계 자동 위치 보정
- **XLSX Export**: `exportToFile('xlsx', ...)` / `exportToString('xlsx')` 지원
  - 외부 의존성 없는 순수 TypeScript 구현 (ZIP STORE + OOXML)
  - 헤더 행 포함, 숫자/날짜/불리언 셀 타입 지원, 헤더 bold 스타일

### Changed
- `ExportFormat`에 `'xlsx'` 추가
- `exportToString` 반환 타입: `string | Uint8Array` (xlsx는 Uint8Array)
- `context-menu` CustomEvent가 이제 `cancelable: true`

---

## [0.13.0] - 2026-05-19

### Added
- **셀 표시 형식 (`format`)**: `ColumnDefinition.format`에 형식 문자열(`'#,##0.00'`, `'0.00%'`, `'$#,##0'`, `'yyyy-MM-dd'` 등) 또는 커스텀 함수 지정. 편집/클립보드에는 raw value 유지
- **조건부 서식 (`conditionalRules`)**: `ColumnDefinition.conditionalRules`에 `{ when, style }` 규칙 배열 지정. 조건 true 시 background/color/fontWeight/fontStyle 인라인 스타일 적용. 다중 규칙 병합
- **자동완성 편집기 (`autocomplete`)**: `ColumnDefinition.autocomplete: true | 'strict'`. 텍스트 편집 시 기존 컬럼 값 기반 드롭다운 제안. Arrow Down/Up으로 탐색, Enter로 선택. `'strict'` 모드는 목록 외 값 거부
- **컬럼 숨기기/표시 UI**: 헤더 우클릭 → 내장 컨텍스트 메뉴 (Hide column / Show 숨긴 열). 숨겨진 열 인접 인디케이터 버튼. `hideColumn(key)` / `showColumn(key)` / `getHiddenColumns()` API

### Changed
- `ColumnDefinition`에 `format`, `conditionalRules`, `autocomplete` 필드 추가
- 새 공개 타입: `CellStyle`, `ConditionalRule`
- 새 이벤트: `header-context-menu`, `column-visibility-change`

---

## [0.12.0] - 2026-05-19

### Added
- **비연속 다중 선택 (Ctrl+Click)**: Ctrl+Click으로 떨어진 셀들 추가/제거 토글. 선택된 비연속 셀 Delete 시 일괄 클리어 (단일 undo)
- **컬럼 드래그 이동 UI**: 헤더 셀 드래그로 열 순서 변경. ghost + 드롭 인디케이터 표시. 리사이즈 핸들과 드래그 영역 분리
- **드롭다운 편집기 (`type: 'select'`)**: `options: string[] | { label, value }[]` 로 셀 편집 시 `<select>` 편집기 표시. 미편집 시 label 표시
- **찾기/바꾸기 (Ctrl+F / Ctrl+H)**: 찾기 패널 + 바꾸기 패널 오버레이. 다음/이전 이동, 단건/모두 바꾸기 (모두 바꾸기는 단일 undo). `find-replace` 이벤트
- **행 드래그 정렬**: 행 번호 셀 드래그로 행 순서 변경. ghost + 수평 인디케이터. undo/redo + `row-reorder` 이벤트
- **Fill Handle**: 선택 범위 우하단 8px 핸들 드래그로 값 복제/시리즈 채우기. 숫자 등차수열 자동 감지. undo/redo + `fill-handle-apply` 이벤트
- Ctrl+Z/Y 키가 active cell 없이도 동작하도록 개선 (전역 처리)

### Changed
- `ColumnDefinition`에 `options?: string[] | SelectOption[]` 필드 추가
- `ColumnType`에 `'select'` 추가

---

## [0.11.0] - 2026-05-18

### Added
- Mouse drag range selection: mousedown + mouseenter로 셀 범위 드래그 확장
- Fill Down (Ctrl+D): 선택 범위 첫 행 값을 아래 행에 채우기. 단일 셀 시 위 셀 값 복사
- Fill Right (Ctrl+R): 선택 범위 첫 열 값을 오른쪽 열에 채우기. 단일 셀 시 왼쪽 셀 값 복사
- 모든 Fill 동작은 undo/redo 지원

---

## [0.10.0] - 2026-03-31

### Added
- React wrapper via `@iyulab/flex-table/react` subpath export
- `FlexTableReact` component wraps `<flex-table>` for idiomatic React usage
- All 23 custom events mapped to React callback props (onCellSelect, onSortChange, etc.)
- `react` and `@lit/react` as optional peer dependencies

### Changed
- Vite build now produces multi-entry output (flex-table + react)

## [0.9.0] - 2026-03-31

### Added
- `pinned: 'right'` support for right-side fixed columns during horizontal scroll
- Scroll-only update optimization: `_recomputeView()` skipped during pure scroll events (100K+ row performance)
- `_getPinnedRight()` method for calculating right-pinned column offsets

### Changed
- `willUpdate()` uses `changedProperties` analysis to skip unnecessary filter/sort recomputation
- `ColumnDefinition.pinned` type extended: `'left' | 'right'`
- Pinned column rendering unified for header, body, and footer cells

## [0.8.0] - 2026-03-31

### Added
- ESLint configuration (`@typescript-eslint` + `eslint-plugin-lit`, flat config)
- `lint` and `lint:fix` npm scripts
- 5 API coverage tests (getColumnWidth, activeCell, editingCell, sortCriteria, filterKeys)
- `minWidth` enforcement in cell rendering (not just resize)

### Changed
- `_onKeyDown` refactored: split into `_handleCtrlKey`, `_handleAltKey`, `_handleNavigation`
- `_handlePaste` refactored: split into `_readClipboardText`, `_expandRowsForPaste`, `_applyPasteData`
- `_getColWidth` now enforces `minWidth` floor on all rendered cells

## [0.7.0] - 2026-03-31

### Added
- Date/datetime filter UI with native date range picker (from/to inputs)
- Column selection via `selectColumn(colIndex)` API and Ctrl+Click on header
- `column-select` event with column index, key, and row count detail
- Keyboard column resize with Alt+ArrowLeft/Right (±20px per keystroke)
- Validation visual feedback: red border + `aria-invalid` on cells that fail validator (auto-clears after 3s)
- Filter UI state persistence: text, number, and date filter inputs retain values when dropdown reopens

### Fixed
- Filter dropdown clipped at viewport bottom now flips upward (boundary detection)
- Number filter inputs now reflect `_numberFilterState` via `.value` binding (API↔UI sync)
- Text filter inputs now track state across open/close cycles

## [0.6.3] - 2026-03-31

### Fixed
- Pinned column rendered one row below due to block-level stacking of `position: sticky` elements
- Header pinned/prefix cells not visible on vertical scroll (nested `position: sticky` paint issue in Chrome)
- Whitespace gap between row-number and pinned columns caused by inline-flex layout hack
- Unified all prefix/pinned cell positioning to `position: absolute` with `scrollLeft` compensation across header, body, and footer

### Added
- GitHub Actions CI/CD: npm publish on release, GitHub Pages demo deployment
- `build:demo` script and `vite.config.demo.ts` for standalone demo build
- npm version existence check in publish workflow (idempotent deploys)

### Changed
- `.ft-header` z-index raised from 2 to 3 to ensure header paints above body sticky cells

## [0.6.0] - 2026-02-20

### Added
- Horizontal virtual scrolling: only columns visible in the viewport (+ 5 overscan) are rendered to DOM
- Constant DOM footprint regardless of column count (50, 100, or more columns)
- `data-col-index` attribute on cells for reliable column identification
- Demo: 100-column horizontal virtual scroll test section

### Changed
- Row/cell layout changed from CSS Grid to absolute positioning for selective column rendering
- Auto-fit resize and context menu now use `data-col-index` instead of DOM position
- `_scrollToActiveCell` uses cached column offsets instead of manual recomputation

### Fixed
- Filter predicate error handling wraps predicates in try-catch (fail-open)
- Data mutation reactivity: `hasChanged: () => true` on data property, public `refreshData()` method

## [0.5.0] - 2026-02-19

### Added
- Row selection via checkbox (`selectable` property, `selection-mode` attribute)
- `selectAll()`, `deselectAll()`, `getSelectedRows()` public API
- `selection-change` event with `{ selectedIndices, selectedRows }` detail
- Footer/summary row support (`footer-data` property)
- Data mode: `dataMode` property (`'client'` / `'server'`)
- Context menu event: `context-menu` with position, row data, and column info

## [0.4.0] - 2026-02-19

### Added
- `aria-selected` on all cells (`"true"` / `"false"`) per WAI-ARIA grid pattern
- `aria-readonly="true"` on non-editable cells (global `editable` or per-column `editable`)
- `aria-label` and `aria-expanded` on filter buttons for screen reader support
- Editor focus outline (`outline: 2px solid`) for keyboard navigation visibility
- README: full API documentation rewrite (Properties, Methods, Events, Usage Guide)

### Changed
- Filter button opacity `0.5` → `0.7` for improved visibility (WCAG)

## [0.3.0] - 2026-02-19

### Added
- `addColumn(def, index?)` method — dynamically add columns
- `deleteColumn(key)` method — remove columns with automatic filter/sort cleanup
- `moveColumn(key, newIndex)` method — reorder columns programmatically
- `updateRows(changes)` method — batch update multiple cells as single undo action
- `exportToString(format, { selectionOnly: true })` — export only selected range
- `maxUndoSize` property (`max-undo-size` attribute) — configurable undo stack size
- `showFilters` property (`show-filters` attribute) — built-in header filter dropdown UI
- `ColumnDefinition.pinned` field — freeze columns during horizontal scroll (`'left'`)
- Built-in filter UI: text search, number range (min/max), boolean toggle
- Filter active indicator — highlighted filter icon when filter is applied
- Events: `column-add`, `column-delete`, `column-reorder`, `batch-update`
- Row number column sticky positioning on horizontal scroll
- Demo: add/delete column buttons, pinned columns, built-in filter UI

## [0.2.0] - 2026-02-19

### Added
- `theme` property with `reflect: true` — programmatic theme switching (`table.theme = 'dark'`)
- `editable` property — global read-only mode (`table.editable = false`)
- `ColumnDefinition.editable` field — per-column editing control
- `maxRows` property — cap row additions and paste auto-expansion
- `canUndo` / `canRedo` public getters
- `undo-state-change` event with `{ canUndo, canRedo }` detail
- `cell-edit-start` event with `{ row, col, key, value }` detail
- `clipboard-error` event on clipboard API failure
- `getColumnWidth(key)` method — query internal resize widths
- RFC 4180 compliant clipboard parser (quoted fields, embedded tabs/newlines)
- Horizontal scroll tracking in keyboard navigation
- Column auto-fit on resize handle double-click
- Demo: filter UI, add row, export CSV, undo/redo status display
- `typecheck` and `test:coverage` npm scripts

### Fixed
- `aria-sort` no longer rendered on non-sortable columns (ARIA spec compliance)
- Column resize no longer mutates original `ColumnDefinition` objects
- Date/datetime export uses ISO 8601 for `Date` objects
- Clipboard errors now dispatch events instead of being silently swallowed

### Changed
- `addRow()` returns `DataRow | null` (returns `null` when `maxRows` reached)

## [0.1.0] - 2026-02-19

### Added
- Initial release
- `<flex-table>` Lit 3 web component with CSS Grid layout
- Column types: text, number, boolean, date, datetime
- Custom cell renderer via `ColumnDefinition.renderer` callback
- Virtual scroll (10K+ rows, overscan=5)
- Cell selection and keyboard navigation (Arrow, Tab, Home, End, Ctrl+Home/End)
- Range selection (Shift+Arrow, Shift+Click)
- Row selection via row number click
- Inline editing (Enter/F2, Escape, Tab/Enter commit)
- Type-specific editors (text, number, date, datetime-local, boolean toggle)
- Type-to-start editing (printable character starts edit with that character)
- Clipboard: copy (Ctrl+C), cut (Ctrl+X), paste (Ctrl+V) in TSV format
- Paste auto-expand rows beyond data bounds
- Delete/Backspace clears selected range
- Column sorting (header click asc/desc/none)
- Multi-column sorting (Shift+click)
- Sort indicators (arrow + order number)
- Filter API: `setFilter()`, `removeFilter()`, `clearFilters()`
- Row operations: `addRow()`, `deleteRows()`
- Undo/Redo (Ctrl+Z/Y, max 100 actions)
- Column resize (drag header border)
- Optional row numbers (`show-row-numbers` attribute)
- Dark/Light theme (CSS custom properties, `prefers-color-scheme` auto)
- Export: `exportToString('csv'|'tsv'|'json')`, `exportToFile()`
- ARIA: `role="grid"`, `aria-sort`, `aria-rowcount`, `aria-colcount`
- Events: cell-select, cell-edit-commit, cell-edit-cancel, sort-change, filter-change, row-add, row-delete, column-resize, clipboard-copy, clipboard-cut, clipboard-paste
- 16 CSS custom properties for theming
- README with full API documentation

[unreleased]: https://github.com/iyulab/flex-table/compare/v0.10.0...HEAD
[0.10.0]: https://github.com/iyulab/flex-table/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/iyulab/flex-table/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/iyulab/flex-table/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/iyulab/flex-table/compare/v0.6.3...v0.7.0
[0.6.3]: https://github.com/iyulab/flex-table/compare/v0.6.0...v0.6.3
[0.6.0]: https://github.com/iyulab/flex-table/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/iyulab/flex-table/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/iyulab/flex-table/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/iyulab/flex-table/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/iyulab/flex-table/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/iyulab/flex-table/releases/tag/v0.1.0
