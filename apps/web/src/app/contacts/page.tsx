"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { ContactList } from "@/components/contacts/ContactList";
import { ContactFilters } from "@/components/contacts/ContactFilters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  PlusIcon,
  UploadIcon,
  DownloadIcon,
} from "@heroicons/react/24/outline";
import { GET_CONTACTS } from "@/graphql/queries/contacts";
import { ContactFiltersInput } from "@/types/contact";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ContactFiltersInput>({});
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { data, loading, error, refetch } = useQuery(GET_CONTACTS, {
    variables: {
      filters: {
        ...filters,
        search,
      },
      skip: 0,
      take: 20,
    },
  });

  const handleSearch = (value: string) => {
    setSearch(value);
  };

  const handleFilterChange = (newFilters: ContactFiltersInput) => {
    setFilters(newFilters);
  };

  const handleExport = async () => {
    // TODO: Implement export functionality
    console.log("Export contacts");
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Contacts</h1>
        <p className="mt-2 text-gray-600">
          Manage your contacts and build meaningful relationships
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-4">
          <Input
            type="search"
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="max-w-md"
          />
          <ContactFilters filters={filters} onChange={handleFilterChange} />
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsImportModalOpen(true)}
          >
            <UploadIcon className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <PlusIcon className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-800">
            Error loading contacts: {error.message}
          </p>
        </div>
      )}

      <ContactList
        contacts={data?.contacts?.contacts || []}
        loading={loading}
        onRefresh={() => refetch()}
      />

      {/* TODO: Add CreateContactModal */}
      {/* TODO: Add ImportContactsModal */}
    </div>
  );
}
