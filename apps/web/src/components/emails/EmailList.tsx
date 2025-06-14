"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Mail, Star, Archive, Trash2, Reply, Forward } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Email } from "@/types/email";

interface EmailListProps {
  emails: Email[];
  loading?: boolean;
  selectedEmail?: Email | null;
  onSelectEmail: (email: Email) => void;
  onStarEmail: (email: Email) => void;
  onArchiveEmail: (email: Email) => void;
  onTrashEmail: (email: Email) => void;
  onMarkAsRead: (email: Email) => void;
  onMarkAsUnread: (email: Email) => void;
}

export function EmailList({
  emails,
  loading = false,
  selectedEmail,
  onSelectEmail,
  onStarEmail,
  onArchiveEmail,
  onTrashEmail,
  onMarkAsRead,
  onMarkAsUnread,
}: EmailListProps) {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  const toggleEmailSelection = (emailId: string) => {
    const newSelection = new Set(selectedEmails);
    if (newSelection.has(emailId)) {
      newSelection.delete(emailId);
    } else {
      newSelection.add(emailId);
    }
    setSelectedEmails(newSelection);
  };

  const selectAllEmails = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map((e) => e.id)));
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <Card key={i} className="p-4">
            <div className="flex items-center space-x-4">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-4" />
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Mail className="h-12 w-12 mb-4" />
        <p>No emails found</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {/* Select All Checkbox */}
        <div className="flex items-center space-x-2 px-4 py-2 border-b">
          <Checkbox
            checked={selectedEmails.size === emails.length && emails.length > 0}
            onCheckedChange={selectAllEmails}
          />
          <span className="text-sm text-muted-foreground">
            {selectedEmails.size > 0
              ? `${selectedEmails.size} selected`
              : "Select all"}
          </span>
          {selectedEmails.size > 0 && (
            <div className="flex items-center space-x-2 ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Bulk actions
                }}
              >
                <Archive className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Bulk actions
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Email Items */}
        {emails.map((email) => (
          <Card
            key={email.id}
            className={cn(
              "p-3 cursor-pointer transition-colors hover:bg-accent",
              !email.isRead && "bg-accent/50",
              selectedEmail?.id === email.id && "border-primary",
            )}
            onClick={() => onSelectEmail(email)}
          >
            <div className="flex items-start space-x-3">
              <Checkbox
                checked={selectedEmails.has(email.id)}
                onCheckedChange={() => toggleEmailSelection(email.id)}
                onClick={(e) => e.stopPropagation()}
              />

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  onStarEmail(email);
                }}
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    email.isStarred && "fill-yellow-400 text-yellow-400",
                  )}
                />
              </Button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4
                    className={cn(
                      "text-sm truncate",
                      !email.isRead && "font-semibold",
                    )}
                  >
                    {email.fromName || email.fromEmail}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(email.sentAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>

                <p
                  className={cn(
                    "text-sm truncate mb-1",
                    !email.isRead && "font-medium",
                  )}
                >
                  {email.subject || "(no subject)"}
                </p>

                <p className="text-xs text-muted-foreground truncate">
                  {email.snippet}
                </p>

                <div className="flex items-center gap-2 mt-2">
                  {email.gmailLabels?.includes("IMPORTANT") && (
                    <Badge variant="secondary" className="text-xs">
                      Important
                    </Badge>
                  )}
                  {email.attachments && email.attachments.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      📎 {email.attachments.length}
                    </Badge>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger
                  asChild
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <span className="sr-only">Open menu</span>
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                      />
                    </svg>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onMarkAsRead(email)}>
                    Mark as read
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMarkAsUnread(email)}>
                    Mark as unread
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onArchiveEmail(email)}>
                    <Archive className="mr-2 h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onTrashEmail(email)}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Move to trash
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}
