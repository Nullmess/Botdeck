"use client";

// Modales dangereuses liées aux salons Discord.


import { Input } from "../../../components/ui/field";
import type { ChannelSummary } from "@botdeck/shared";
import type { UiLanguage, UiText } from "@/features/workspace/core";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

const channelRecreateTypeLabel = (type: ChannelSummary["type"], language: UiLanguage) => {
  const labels = language === "fr"
    ? { category: "Catégorie", text: "Textuel", voice: "Vocal", forum: "Forum", thread: "Thread", dm: "Message privé" }
    : { category: "Category", text: "Text", voice: "Voice", forum: "Forum", thread: "Thread", dm: "Direct message" };
  return labels[type] ?? type;
};

const channelRecreateConfirmationIsValid = (value: string) => ["RECREER", "RECREATE", "CONFIRMER", "CONFIRM"].includes(value.trim().toUpperCase());

export function ChannelRecreateModal({
  target,
  language,
  text,
  reason,
  confirmation,
  onReasonChange,
  onConfirmationChange,
  onClose,
  onConfirm,
}: {
  target: ChannelSummary;
  language: UiLanguage;
  text: UiText;
  reason: string;
  confirmation: string;
  onReasonChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal surfaceClassName="botModal actionConfirmModal channelRecreateModal" aria-label={language === "fr" ? "Confirmer la réinitialisation du salon" : "Confirm channel reset"} onClose={onClose}>
        <div className="botModalHeader channelRecreateHeader">
          <div className="channelRecreateTitleGroup">
            <span className="channelRecreateIcon" aria-hidden="true">↻</span>
            <div>
              <p className="eyebrow">{language === "fr" ? "Action définitive" : "Final action"}</p>
              <h2>{language === "fr" ? "Réinitialiser le salon" : "Reset channel"}</h2>
            </div>
          </div>
          <Button variant="unstyled" className="modalClose" type="button" onClick={onClose} aria-label={language === "fr" ? "Fermer" : "Close"}>×</Button>
        </div>

        <div className="channelRecreateBody">
          <p className="channelRecreateBrief">
            {language === "fr" ? "Crée une copie du salon, conserve la configuration, puis supprime l’ancien après succès." : "Creates a channel copy, keeps the settings, then deletes the old one after success."}
          </p>

          <div className="channelRecreateTargetBox">
            <div>
              <span>{language === "fr" ? "Cible" : "Target"}</span>
              <strong>#{target.name}</strong>
            </div>
            <div>
              <span>{language === "fr" ? "Type" : "Type"}</span>
              <strong>{channelRecreateTypeLabel(target.type, language)}</strong>
            </div>
            <div>
              <span>{language === "fr" ? "Catégorie" : "Category"}</span>
              <strong>{target.categoryName ?? (language === "fr" ? "Aucune" : "None")}</strong>
            </div>
          </div>

          <div className="channelRecreateNotice" role="alert">
            <span>⚠</span>
            <p>{language === "fr" ? "L’historique Discord original sera perdu." : "Original Discord history will be lost."}</p>
          </div>

          <label className="channelRecreateField">
            <span>{language === "fr" ? "Raison" : "Reason"}</span>
            <Input value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder={language === "fr" ? "Optionnel" : "Optional"} />
          </label>

          <div className="channelRecreateConfirmBox">
            <label className="channelRecreateField">
              <span>{language === "fr" ? "Confirmation" : "Confirmation"}</span>
              <Input value={confirmation} onChange={(event) => onConfirmationChange(event.target.value)} placeholder={language === "fr" ? "Tape RECREER" : "Type RECREATE"} />
            </label>
            <small>{language === "fr" ? "Suppression uniquement après création réussie." : "Deletion only after successful creation."}</small>
          </div>
        </div>

        <div className="modalActions channelRecreateActions">
          <Button variant="unstyled" className="sendButton secondaryButton" type="button" onClick={onClose}>{text.cancel}</Button>
          <Button variant="unstyled" className="sendButton dangerButton" type="button" onClick={onConfirm} disabled={!channelRecreateConfirmationIsValid(confirmation)}>{language === "fr" ? "Exécuter" : "Execute"}</Button>
        </div>
      </Modal>
  );
}

export function ChannelDeleteModal({
  target,
  language,
  text,
  onClose,
  onConfirm,
}: {
  target: ChannelSummary;
  language: UiLanguage;
  text: UiText;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal surfaceClassName="botModal actionConfirmModal" aria-label={language === "fr" ? "Confirmer la suppression" : "Confirm deletion"} onClose={onClose}>
        <div className="botModalHeader">
          <p className="eyebrow">{target.type === "category" ? (language === "fr" ? "Supprimer la catégorie" : "Delete category") : (language === "fr" ? "Supprimer le salon" : "Delete channel")}</p>
          <Button variant="unstyled" className="modalClose" type="button" onClick={onClose}>×</Button>
        </div>
        <h2>{language === "fr" ? `Supprimer ${target.name} ?` : `Delete ${target.name}?`}</h2>
        <p className="subtle">{language === "fr" ? "Cette action sera envoyée à Discord avec le bot et ne peut pas être annulée depuis Botdeck." : "This action will be sent to Discord with the bot and cannot be undone from Botdeck."}</p>
        <div className="modalActions">
          <Button variant="unstyled" className="sendButton secondaryButton" type="button" onClick={onClose}>{text.cancel}</Button>
          <Button variant="unstyled" className="sendButton dangerButton" type="button" onClick={onConfirm}>{language === "fr" ? "Supprimer" : "Delete"}</Button>
        </div>
      </Modal>
  );
}
