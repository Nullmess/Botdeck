// Aperçu embed Slash Studio.

import { renderMessageContent } from "@/features/workspace/core";
import type { CommandEmbedPageDraft } from "./slash-studio-command-runtime";
import { Button } from "../../../components/ui/button";

export function safePreviewImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("{") || trimmed.includes("}")) return "";
  if (/^(https?:\/\/|data:image\/|blob:)/i.test(trimmed)) return trimmed;
  return "";
}

export function CommandEmbedPreviewPanel({
  page,
  previewValue,
  pageIndex,
  pageCount,
  onPrevious,
  onNext,
}: {
  page: CommandEmbedPageDraft;
  previewValue: (value: string) => string;
  pageIndex: number;
  pageCount: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const previewTitle = previewValue(page.title || "Titre de l'embed");
  const previewDescription = previewValue(
    page.description || "Description de l'embed",
  );
  const previewAuthorIconUrl = safePreviewImageUrl(
    previewValue(page.authorIconUrl),
  );
  const previewFooterIconUrl = safePreviewImageUrl(
    previewValue(page.footerIconUrl),
  );
  const previewAuthor = previewValue(
    page.author || (previewAuthorIconUrl ? "Auteur d’exemple" : ""),
  );
  const previewFooter = previewValue(
    page.footer || (previewFooterIconUrl ? "Footer d’exemple" : ""),
  );
  const previewImageUrl = safePreviewImageUrl(previewValue(page.imageUrl));
  const previewThumbnailUrl = safePreviewImageUrl(
    previewValue(page.thumbnailUrl),
  );
  return (
    <div className="commandEmbedPreviewPane">
      <div
        className="commandEmbedPreview"
        style={{ borderLeftColor: page.color }}
      >
        <div className="commandEmbedPreviewBody">
          {previewAuthor ? (
            <small className="commandEmbedPreviewAuthor">
              {previewAuthorIconUrl ? (
                <img src={previewAuthorIconUrl} alt="" aria-hidden="true" />
              ) : null}
              {renderMessageContent(
                previewAuthor,
                `embed-preview-author-${page.id}`,
              )}
            </small>
          ) : null}
          <strong>
            {renderMessageContent(
              previewTitle,
              `embed-preview-title-${page.id}`,
            )}
          </strong>
          <div className="commandEmbedPreviewDescription">
            {renderMessageContent(
              previewDescription,
              `embed-preview-description-${page.id}`,
            )}
          </div>
          {page.fields.length ? (
            <dl>
              {page.fields.map((field) => (
                <div key={field.id}>
                  <dt>
                    {renderMessageContent(
                      previewValue(field.name || "Champ"),
                      `embed-preview-field-name-${field.id}`,
                    )}
                  </dt>
                  <dd>
                    {renderMessageContent(
                      previewValue(field.value || "Valeur"),
                      `embed-preview-field-value-${field.id}`,
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          {previewImageUrl ? (
            <div className="commandEmbedImagePreview">
              <img src={previewImageUrl} alt="" aria-hidden="true" />
              <span>{previewImageUrl}</span>
            </div>
          ) : null}
          {previewFooter ? (
            <footer>
              {previewFooterIconUrl ? (
                <img src={previewFooterIconUrl} alt="" aria-hidden="true" />
              ) : null}
              {renderMessageContent(
                previewFooter,
                `embed-preview-footer-${page.id}`,
              )}
            </footer>
          ) : null}
          {pageCount > 1 ? (
            <div className="commandMenuPreviewButtons">
              <Button variant="unstyled"
                type="button"
                onClick={onPrevious}
                disabled={pageIndex === 0}
              >
                ←
              </Button>
              <span>
                {pageIndex + 1} / {pageCount}
              </span>
              <Button variant="unstyled"
                type="button"
                onClick={onNext}
                disabled={pageIndex >= pageCount - 1}
              >
                →
              </Button>
            </div>
          ) : null}
        </div>
        {previewThumbnailUrl ? (
          <div className="commandEmbedThumbPreview">
            <img src={previewThumbnailUrl} alt="" aria-hidden="true" />
            <span>{previewThumbnailUrl}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
