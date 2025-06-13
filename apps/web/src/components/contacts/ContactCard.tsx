import { useState } from "react";
import { Contact } from "@/types/contact";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  EnvelopeIcon,
  PhoneIcon,
  EllipsisHorizontalIcon,
  PencilIcon,
  TrashIcon,
  BuildingOfficeIcon,
} from "@heroicons/react/24/outline";

interface ContactCardProps {
  contact: Contact;
  onUpdate: () => void;
}

export function ContactCard({ contact, onUpdate }: ContactCardProps) {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fullName =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    "Unnamed Contact";

  const initials =
    [contact.firstName?.[0], contact.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this contact?")) {
      // TODO: Implement delete
      console.log("Delete contact", contact.id);
      onUpdate();
    }
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={contact.avatarUrl} alt={fullName} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{fullName}</CardTitle>
              {contact.title && (
                <CardDescription className="text-sm">
                  {contact.title}
                </CardDescription>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <EllipsisHorizontalIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsEditModalOpen(true)}>
                <PencilIcon className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-red-600 focus:text-red-600"
              >
                <TrashIcon className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {contact.email && (
          <div className="flex items-center text-sm text-gray-600">
            <EnvelopeIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <a
              href={`mailto:${contact.email}`}
              className="truncate hover:text-blue-600"
            >
              {contact.email}
            </a>
          </div>
        )}
        {contact.phone && (
          <div className="flex items-center text-sm text-gray-600">
            <PhoneIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <a
              href={`tel:${contact.phone}`}
              className="truncate hover:text-blue-600"
            >
              {contact.phone}
            </a>
          </div>
        )}
        {contact.company && (
          <div className="flex items-center text-sm text-gray-600">
            <BuildingOfficeIcon className="mr-2 h-4 w-4 flex-shrink-0" />
            <span className="truncate">{contact.company.name}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-2">
          <Badge variant="secondary" className="text-xs">
            {contact.source}
          </Badge>
          <Badge
            variant={contact.status === "ACTIVE" ? "default" : "outline"}
            className="text-xs"
          >
            {contact.status}
          </Badge>
        </div>
      </CardContent>

      {/* TODO: Add EditContactModal */}
    </Card>
  );
}
