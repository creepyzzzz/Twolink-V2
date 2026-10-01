/** A frozen snapshot of the message being replied to. */
export type ReplyQuote = {
  id: string;
  from: "me" | "them";
  text: string;
  photo?: boolean;
};

/**
 * A file attached to a message. `uri` is a signed URL for remote files or a
 * local cache URI for picked-but-unsent files.
 */
export type DocumentAttachment = {
  /** Original file name, e.g. "contract.pdf". */
  name: string;
  /** Size in bytes. */
  size: number;
  /** MIME type, e.g. "application/pdf". */
  mimeType: string;
  /** Renderable URI: signed remote URL or local cache URI. */
  uri: string;
};

export type Message = {
  id: string;
  from: "me" | "them";
  text: string;
  at: string;
  /** Raw epoch ms behind `at` — used for history pagination and read math. */
  createdAtMs?: number;
  /** Group threads: which member sent this (a Supabase user id). */
  senderId?: string;
  photo?: boolean;
  /** Renderable URI: signed remote URL or local file URI. */
  photoUri?: string;
  /** The message this one replies to, if any. */
  replyTo?: ReplyQuote;
  /** Emoji tapbacks on this message (long-press to add/remove). */
  reactions?: string[];
  /**
   * File attached to this message. `text` mirrors the file name so inbox
   * previews, search, and reply quotes keep working unchanged.
   */
  document?: DocumentAttachment;
  /**
   * Epoch ms when a disappearing message expires. Only set on messages
   * sent after the thread's timer was enabled.
   */
  expiresAt?: number;
  /** True once the sender edited the text after sending. */
  edited?: boolean;
  /**
   * Delivery state for outgoing messages (WhatsApp-style ticks). Incoming
   * messages never carry one. Live: derived from message_receipts —
   * sent → delivered → read.
   */
  status?: MessageStatus;
  /**
   * "Delete for everyone" replaces the content with a tombstone instead of
   * removing the row, so the thread keeps its shape.
   */
  deletedForEveryone?: boolean;
};

/** Delivery state for outgoing messages (WhatsApp-style ticks). */
export type MessageStatus = "sent" | "delivered" | "read";
