# Styling, keyboard, localization

## Sizing

The host is the scroll container and virtualizes against its own height:

```css
flex-table { height: 400px; }
/* or inside a flex column */
.page { height: 100%; display: flex; flex-direction: column; }
.page flex-table { flex: 1 1 auto; min-height: 0; }
```

## Theming

Every `--ft-*` color falls back to an `@iyulab/components` design token, so loading that token sheet
makes the grid follow the app theme (e.g. `:root { --u-primary-color: #7b1fa2; }`). Without the sheet,
literal fallbacks and the built-in dark theme (`prefers-color-scheme` or `theme="dark"`) still apply.

Override individual properties to make the table differ from the rest of the app:

| Group | Custom properties |
|---|---|
| Font | `--ft-font-family`, `--ft-font-size` |
| Surfaces / text | `--ft-bg`, `--ft-text-color`, `--ft-border-color`, `--ft-editor-bg`, `--ft-empty-color` |
| Header | `--ft-header-bg`, `--ft-header-hover-bg`, `--ft-header-text-color`, `--ft-sort-indicator-color` |
| Rows | `--ft-row-even-bg`, `--ft-row-odd-bg`, `--ft-row-hover-bg`, `--ft-row-odd-hover-bg` |
| Accent | `--ft-active-color`, `--ft-selection-bg`, `--ft-bool-color` |
| State overlays | `--ft-invalid-color`, `--ft-drop-color`, `--ft-find-color` (translucent backgrounds derive from these) |

```css
flex-table {
  --ft-font-size: 13px;
  --ft-active-color: #1a73e8;
  --ft-row-odd-bg: #fafafa;
}
```

### Styling custom cell content

`render` output lives in the shadow root, so page CSS does not reach it. Pass constructable
stylesheets instead (reassigning replaces the previous set):

```ts
const sheet = new CSSStyleSheet();
sheet.replaceSync('.badge { padding: 0 6px; border-radius: 4px; }');
table.stylesheets = [sheet];
```

## Density and header hierarchy

```css
flex-table {
  --ft-row-height: 28px;
  --ft-cell-padding-block: 4px;
  --ft-cell-padding-inline: 8px;
  --ft-header-font-size: 13px;   /* defaults to --ft-font-size */
  --ft-header-font-weight: 600;
}
```

- `--ft-row-height` is read once at first render and only in `px`; to change it later set the
  `rowHeight` property / `row-height` attribute (which always win over the token).
- Cells are single-line. When reducing row height, reduce `--ft-cell-padding-block` too
  (`padding-block × 2 + line box ≤ row height`), or text is clipped.

## Keyboard

| Key | Action |
|---|---|
| Arrows / Tab / Shift+Tab | Move between cells; Tab past the last (Shift+Tab before the first) leaves the table |
| ArrowUp on the first row | Move onto the header row (arrows / Home / End along it, ArrowDown back) |
| Enter / Space on a header cell | Sort (Shift adds to the sort) |
| Alt+ArrowDown or context-menu key on a header cell | Open the column menu |
| Home / End, Ctrl+Home / Ctrl+End | Row start/end, table start/end |
| Shift+Arrow, Shift+Click | Extend range selection |
| Shift+Space | Select / deselect the active cell's row (`selectable`; row checkboxes are not Tab stops) |
| Ctrl+Click header | Select column |
| Enter / F2 | Edit (Enter on a non-editable cell fires `row-activate`) |
| Typing a printable character | Start editing an editable cell |
| Escape | Cancel edit / clear selection / close find panel |
| Delete / Backspace | Clear selected cells |
| Ctrl+C / Ctrl+X / Ctrl+V | Copy / cut / paste as TSV (Excel / Google Sheets compatible) |
| Ctrl+D / Ctrl+R | Fill down / fill right |
| Ctrl+F / Ctrl+H | Find / find and replace |
| Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z | Undo, redo |
| Alt+ArrowLeft / Alt+ArrowRight | Resize current column |
| Enter / Space on a column menu button | Open the column menu (arrows, Home/End navigate; Escape closes) |

The table is one Tab stop with roving focus — the focus sits on the active cell or header cell (screen
readers announce each move); keyboard focus arriving on it activates the first cell; the column menu
buttons are not Tab stops (the header row reaches them).

Ctrl also matches Cmd on macOS. Editing shortcuts are ignored when `editable` is `false`.

## Localization

The grid's own chrome (column menu, filters, find/replace, context menu, empty states) uses a locale
namespace. English and Korean are built in and follow the active `@iyulab/components` locale:

```ts
import { Locale } from '@iyulab/components';
Locale.set('ko');
```

Add a language or reword strings with partial tables; `FlexTableMessageKey` lists the valid keys:

```ts
import { flexTableLocale } from '@iyulab/flex-table';

flexTableLocale.register('ja', { contains: '含む', startsWith: '前方一致' });
flexTableLocale.register('en', { replaceAll: 'Replace everything' });
flexTableLocale.register('ja', { columnMenuFor: '{header} の列メニュー' }); // {header} placeholder
```

`emptyMessage` and `noMatchingMessage` can also be set per table.
