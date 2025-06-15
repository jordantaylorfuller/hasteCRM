"use client";

import { format } from "date-fns";
import {
  Star,
  Archive,
  Trash2,
  Reply,
  ReplyAll,
  Forward,
  Printer,
  MoreVertical,
  Paperclip,
  Download,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Email } from "@/types/email";

interface EmailViewerProps {
  email: Email | null;
  onClose?: () => void;
  onReply?: (_emailToReply: Email) => void;
  onReplyAll?: (_emailToReplyAll: Email) => void;
  onForward?: (_emailToForward: Email) => void;
  onStarEmail?: (_emailToStar: Email) => void;
  onArchiveEmail?: (_email: Email) => void;
  onTrashEmail?: (_email: Email) => void;
  onMarkAsUnread?: (_email: Email) => void;
}

export function EmailViewer({
  email,
  onClose,
  onReply,
  onReplyAll,
  onForward,
  onStarEmail,
  onArchiveEmail,
  onTrashEmail,
  onMarkAsUnread,
}: EmailViewerProps) {
  if (!email) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select an email to view</p>
      </div>
    );
  }

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email?.slice(0, 2).toUpperCase() || "?";
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <Card className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold truncate flex-1 mr-4">
            {email.subject || "(no subject)"}
          </h2>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => onReply?.(email)}>
            <Reply className="h-4 w-4 mr-2" />
            Reply
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onReplyAll?.(email)}
          >
            <ReplyAll className="h-4 w-4 mr-2" />
            Reply All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onForward?.(email)}
          >
            <Forward className="h-4 w-4 mr-2" />
            Forward
          </Button>

          <div className="ml-auto flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onStarEmail?.(email)}
            >
              <Star
                className={cn(
                  "h-4 w-4",
                  email.isStarred && "fill-yellow-400 text-yellow-400",
                )}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onArchiveEmail?.(email)}
            >
              <Archive className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTrashEmail?.(email)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onMarkAsUnread?.(email)}>
                  Mark as unread
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>View original</DropdownMenuItem>
                <DropdownMenuItem>Report spam</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Email Content */}
      <ScrollArea className="flex-1">
        <div className="p-6">
          {/* Sender Info */}
          <div className="flex items-start space-x-4 mb-6">
            <Avatar>
              <AvatarImage
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${email.fromEmail}`}
              />
              <AvatarFallback>
                {getInitials(email.fromName, email.fromEmail)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">
                    {email.fromName || email.fromEmail}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {email.fromEmail}
                  </p>
                </div>
                <time className="text-sm text-muted-foreground">
                  {format(new Date(email.sentAt), "PPpp")}
                </time>
              </div>

              {/* Recipients */}
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex">
                  <span className="text-muted-foreground mr-2">To:</span>
                  <span>{email.toEmails.join(", ")}</span>
                </div>
                {email.ccEmails.length > 0 && (
                  <div className="flex">
                    <span className="text-muted-foreground mr-2">Cc:</span>
                    <span>{email.ccEmails.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Labels */}
          {email.gmailLabels && email.gmailLabels.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {email.gmailLabels.map((label) => (
                <Badge key={label} variant="secondary">
                  {label}
                </Badge>
              ))}
            </div>
          )}

          <Separator className="my-4" />

          {/* Email Body */}
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {email.bodyHtml ? (
              <div dangerouslySetInnerHTML={{ __html: email.bodyHtml }} />
            ) : (
              <div className="whitespace-pre-wrap">{email.bodyText}</div>
            )}
          </div>

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <>
              <Separator className="my-6" />
              <div>
                <h4 className="font-medium mb-3 flex items-center">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attachments ({email.attachments.length})
                </h4>
                <div className="space-y-2">
                  {email.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent"
                    >
                      <div className="flex items-center space-x-3">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {attachment.filename}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(attachment.size)}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
