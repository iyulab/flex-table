# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[unreleased]: https://github.com/iyulab/flex-table/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/iyulab/flex-table/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/iyulab/flex-table/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/iyulab/flex-table/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/iyulab/flex-table/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/iyulab/flex-table/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/iyulab/flex-table/releases/tag/v0.1.0
