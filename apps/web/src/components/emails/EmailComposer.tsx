"use client";

import { useState, useRef, useEffect } from "react";
import {
  X,
  Send,
  Paperclip,
  Image,
  Link,
  Bold,
  Italic,
  List,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Email } from "@/types/email";

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    attachments?: File[];
    replyToId?: string;
  }) => Promise<void>;
  replyTo?: Email;
  replyAll?: boolean;
  forward?: boolean;
  defaultTo?: string[];
  defaultSubject?: string;
  defaultBody?: string;
}

export function EmailComposer({
  isOpen,
  onClose,
  onSend,
  replyTo,
  replyAll,
  forward,
  defaultTo = [],
  defaultSubject = "",
  defaultBody = "",
}: EmailComposerProps) {
  const [to, setTo] = useState<string[]>(defaultTo);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [currentRecipient, setCurrentRecipient] = useState("");
  const [recipientType, setRecipientType] = useState<"to" | "cc" | "bcc">("to");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (replyTo) {
      if (forward) {
        setSubject(`Fwd: ${replyTo.subject}`);
        setBody(
          `\n\n---------- Forwarded message ----------\nFrom: ${replyTo.fromName || replyTo.fromEmail}\nDate: ${new Date(replyTo.sentAt).toLocaleString()}\nSubject: ${replyTo.subject}\nTo: ${replyTo.toEmails.join(", ")}\n\n${replyTo.bodyText || replyTo.snippet}`,
        );
      } else {
        setTo([replyTo.fromEmail]);
        if (replyAll) {
          const additionalRecipients = replyTo.toEmails
            .filter((email) => email !== replyTo.fromEmail)
            .concat(replyTo.ccEmails);
          setCc(additionalRecipients);
          setShowCc(additionalRecipients.length > 0);
        }
        setSubject(`Re: ${replyTo.subject.replace(/^Re:\s*/i, "")}`);
        setBody(
          `\n\nOn ${new Date(replyTo.sentAt).toLocaleString()}, ${replyTo.fromName || replyTo.fromEmail} wrote:\n> ${(replyTo.bodyText || replyTo.snippet).split("\n").join("\n> ")}`,
        );
      }
    }
  }, [replyTo, replyAll, forward]);

  const handleAddRecipient = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const email = currentRecipient.trim();
      if (email && email.includes("@")) {
        switch (recipientType) {
          case "to":
            setTo([...to, email]);
            break;
          case "cc":
            setCc([...cc, email]);
            break;
          case "bcc":
            setBcc([...bcc, email]);
            break;
        }
        setCurrentRecipient("");
      }
    }
  };

  const removeRecipient = (email: string, type: "to" | "cc" | "bcc") => {
    switch (type) {
      case "to":
        setTo(to.filter((e) => e !== email));
        break;
      case "cc":
        setCc(cc.filter((e) => e !== email));
        break;
      case "bcc":
        setBcc(bcc.filter((e) => e !== email));
        break;
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSend = async () => {
    if (to.length === 0 || !subject || !body.trim()) {
      return;
    }

    setSending(true);
    try {
      await onSend({
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        body,
        attachments: attachments.length > 0 ? attachments : undefined,
        replyToId: replyTo?.id,
      });
      onClose();
    } catch (error) {
      console.error("Failed to send email:", error);
    } finally {
      setSending(false);
    }
  };

  const formatText = (style: string) => {
    if (!bodyRef.current) return;

    const start = bodyRef.current.selectionStart;
    const end = bodyRef.current.selectionEnd;
    const selectedText = body.substring(start, end);

    let newText = "";
    switch (style) {
      case "bold":
        newText = `**${selectedText}**`;
        break;
      case "italic":
        newText = `*${selectedText}*`;
        break;
      case "list":
        newText = `\n- ${selectedText}`;
        break;
    }

    const newBody = body.substring(0, start) + newText + body.substring(end);
    setBody(newBody);

    // Restore cursor position
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.focus();
        bodyRef.current.setSelectionRange(
          start + newText.length,
          start + newText.length,
        );
      }
    }, 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle>
            {forward ? "Forward Email" : replyTo ? "Reply" : "New Message"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Recipients */}
            <div className="space-y-3">
              {/* To */}
              <div className="flex items-start space-x-2">
                <Label className="w-12 mt-2 text-right">To:</Label>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mb-2">
                    {to.map((email) => (
                      <Badge key={email} variant="secondary">
                        {email}
                        <button
                          onClick={() => removeRecipient(email, "to")}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <Input
                    value={currentRecipient}
                    onChange={(e) => setCurrentRecipient(e.target.value)}
                    onKeyDown={handleAddRecipient}
                    onFocus={() => setRecipientType("to")}
                    placeholder="Add recipients..."
                  />
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCc(!showCc)}
                  >
                    Cc
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowBcc(!showBcc)}
                  >
                    Bcc
                  </Button>
                </div>
              </div>

              {/* Cc */}
              {showCc && (
                <div className="flex items-start space-x-2">
                  <Label className="w-12 mt-2 text-right">Cc:</Label>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {cc.map((email) => (
                        <Badge key={email} variant="secondary">
                          {email}
                          <button
                            onClick={() => removeRecipient(email, "cc")}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      value={recipientType === "cc" ? currentRecipient : ""}
                      onChange={(e) => setCurrentRecipient(e.target.value)}
                      onKeyDown={handleAddRecipient}
                      onFocus={() => {
                        setRecipientType("cc");
                        setCurrentRecipient("");
                      }}
                      placeholder="Add Cc recipients..."
                    />
                  </div>
                </div>
              )}

              {/* Bcc */}
              {showBcc && (
                <div className="flex items-start space-x-2">
                  <Label className="w-12 mt-2 text-right">Bcc:</Label>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {bcc.map((email) => (
                        <Badge key={email} variant="secondary">
                          {email}
                          <button
                            onClick={() => removeRecipient(email, "bcc")}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <Input
                      value={recipientType === "bcc" ? currentRecipient : ""}
                      onChange={(e) => setCurrentRecipient(e.target.value)}
                      onKeyDown={handleAddRecipient}
                      onFocus={() => {
                        setRecipientType("bcc");
                        setCurrentRecipient("");
                      }}
                      placeholder="Add Bcc recipients..."
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Subject */}
            <div className="flex items-center space-x-2">
              <Label className="w-12 text-right">Subject:</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Add a subject"
                className="flex-1"
              />
            </div>

            <Separator />

            {/* Body with formatting toolbar */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2 px-14">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => formatText("bold")}
                  title="Bold"
                >
                  <Bold className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => formatText("italic")}
                  title="Italic"
                >
                  <Italic className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => formatText("list")}
                  title="Bullet List"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Separator orientation="vertical" className="h-6" />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach File"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Compose your message..."
                className="min-h-[300px] resize-none"
              />
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="space-y-2">
                <Label>Attachments:</Label>
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div className="flex items-center space-x-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({formatFileSize(file.size)})
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4">
          <div className="flex justify-between items-center">
            <Button variant="ghost" onClick={onClose}>
              Discard
            </Button>
            <div className="flex space-x-2">
              <Button variant="outline">Save Draft</Button>
              <Button
                onClick={handleSend}
                disabled={
                  sending || to.length === 0 || !subject || !body.trim()
                }
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
