# Common Outstanding Work Research

This note covers the README common/shared UI items. It is based on local code inspection on 2026-05-21.

Primary files:

- `apps/coder/app/common/pure/Markdown/Markdown.tsx`
- `apps/coder/app/common/pure/ImageStrip/ImageStrip.tsx`
- `apps/coder/app/common/pure/FileTypeIcon.tsx`
- `apps/coder/app/features/thread/components/Transcript/TranscriptImages.tsx`
- `apps/coder/app/features/thread/pure/thread/TranscriptImageStripView.tsx`
- `apps/coder/app/features/thread/components/Transcript/MessageArticle.tsx`
- `apps/coder/app/features/thread/components/Transcript/WorkDetails.tsx`
- `apps/coder/assets/createAssetHelper.ts`
- `apps/coder/middlewares/markdown-rewrite/handlers/image-urls.ts`

## Architecture Snapshot

Images can currently enter the UI through:

- transcript image blocks from the reducer,
- user message attachment images,
- generated or viewed images,
- Markdown image syntax that ReactMarkdown renders as a normal `img`,
- asset helper URLs under `/codex-assets`.

There is no shared media preview/lightbox owner. Existing components render inline images directly.

<a id="add-image-preview-slideshow"></a>
## Add Image Preview Slideshow

Status: Confirmed not implemented.

Current behavior:

- `TranscriptImageStrip` maps each image to a plain `<img>`.
- `ImageStrip` maps images to plain `<img>`.
- No click handler, modal, lightbox, slideshow, keyboard navigation, or transcript-wide image registry exists.
- Local path images are lazily registered through `/codex-assets/register`.

Important snippets:

```tsx
// TranscriptImages.tsx
return (
  <div data-testid="transcript-images">
    {images.map((image) => (
      <TranscriptImage image={image} key={image.id} />
    ))}
  </div>
);

function TranscriptImage({ image }) {
  const src = useTranscriptImageSrc(image);
  return src ? <img alt={image.alt ?? "Image"} src={src} /> : null;
}
```

```tsx
// ImageStrip.tsx
{images.map((image) => (
  <img alt={image.alt ?? "Image"} className={styles.image} key={image.id} src={image.src} />
))}
```

Recommended implementation:

1. Add a common `MediaPreviewProvider` or transcript-scoped image registry.
2. Normalize preview items to `{ id, src, alt, caption, originalPath?, blockId? }`.
3. Make every transcript/common image call `openPreview(imageId, imageSetId)`.
4. Add a modal/lightbox with:
   - next/previous controls,
   - Escape close,
   - arrow-key navigation,
   - focus management,
   - responsive image sizing,
   - caption/path display where useful.
5. Include all images in the current transcript/rendered context, not only images in one strip.
6. Reuse the same preview for generated images, attached images, and Markdown images if practical.

Files involved:

- `TranscriptImages.tsx`
- `ImageStrip.tsx`
- `MessageArticle.tsx`
- `WorkDetails.tsx`
- common modal/dialog primitives
- new common media preview component/state

Tests to add:

- Clicking a transcript image opens preview.
- Arrow keys navigate between all transcript images.
- Escape closes and returns focus.
- Local `/codex-assets` images preview after registration.
- Mobile preview fits without clipping controls.

<a id="render-videos-from-markdown-image-syntax"></a>
## Render Videos From Markdown Image Syntax

Status: Confirmed not implemented.

Current behavior:

- `Markdown` only customizes anchor rendering.
- ReactMarkdown will render image syntax as `<img>`.
- If the image syntax points at a video target, the browser receives an `<img src="video.mp4">`, which will not render as a playable video.
- The asset helper content-type list does not include common video MIME types.
- `FileTypeIcon` knows about video extensions, but that is only icon logic.

Important snippets:

```tsx
// Markdown.tsx
const defaultComponents: MarkdownComponents = {
  a: DefaultMarkdownLink
};

<ReactMarkdown components={resolvedComponents}>{text}</ReactMarkdown>
```

```ts
// createAssetHelper.ts
if (extension === ".png") return "image/png";
if (extension === ".css") return "text/css; charset=utf-8";
...
return "application/octet-stream";
```

```ts
// FileTypeIcon.tsx
const videoExtensions = new Set(["avi", "m4v", "mkv", "mov", "mp4", "mpeg", "mpg", "webm"]);
```

Recommended implementation:

1. Add an `img` override to `Markdown`.
2. Detect video targets by extension and, where available, MIME type.
3. Render videos as:

```tsx
<video controls playsInline preload="metadata">
  <source src={src} type={mimeType} />
</video>
```

4. Keep non-video image syntax rendering as an image.
5. Add video MIME types to `contentType()` and `extensionForMime()` in `createAssetHelper.ts`.
6. Consider HTTP range support for `/codex-assets` if local videos need smooth seeking.
7. Apply safe sizing CSS in `Markdown.module.css`.
8. Include a fallback link when the video type is unsupported.

Files involved:

- `Markdown.tsx`
- `Markdown.module.css`
- `createAssetHelper.ts`
- markdown rewrite handlers if local video paths need asset registration
- possibly common media preview from the slideshow task

Tests to add:

- Markdown `![demo](demo.mp4)` renders a `video`, not `img`.
- Markdown `![image](image.png)` still renders an image.
- `/codex-assets/file/*` video responses have a video content type.
- Local video path rewrite keeps the file path hidden.
