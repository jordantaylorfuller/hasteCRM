"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Brain, Mail, Users, TrendingUp, Clock, Star } from "lucide-react";
import { GET_AI_INSIGHTS } from "@/graphql/queries/ai";

export function AiInsightsDashboard() {
  const [timeRange, setTimeRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  });

  const { data, loading, error } = useQuery(GET_AI_INSIGHTS, {
    variables: { timeRange },
    pollInterval: 300000, // Refresh every 5 minutes
  });

  const insights = data?.getAiInsights;

  if (loading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !insights) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Unable to load AI insights at this time.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { communicationPatterns, topContacts, suggestions } = insights;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Brain className="h-8 w-8 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">AI Insights</h2>
          <p className="text-muted-foreground">
            Powered by Claude AI - Last 30 days
          </p>
        </div>
      </div>

      {/* Communication Patterns */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Communication Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {communicationPatterns.totalEmails}
              </p>
              <p className="text-sm text-muted-foreground">Total Emails</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                {communicationPatterns.readRate}
              </p>
              <p className="text-sm text-muted-foreground">Read Rate</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500" />
                {communicationPatterns.starRate}
              </p>
              <p className="text-sm text-muted-foreground">Star Rate</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold flex items-center gap-1">
                <Clock className="h-4 w-4 text-blue-500" />
                {communicationPatterns.avgResponseTime}
              </p>
              <p className="text-sm text-muted-foreground">Avg Response</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm font-medium mb-2">Peak Communication Hours</p>
            <div className="flex gap-2">
              {communicationPatterns.peakHours.map((hour: string) => (
                <Badge key={hour} variant="secondary">
                  {hour}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Contacts
          </CardTitle>
          <CardDescription>
            Your most frequent email correspondents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topContacts.map((contact: any) => (
              <div
                key={contact.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {contact.name
                        .split(" ")
                        .map((n: string) => n[0])
                        .join("")
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {contact.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{contact.interactionCount}</p>
                  <p className="text-xs text-muted-foreground">interactions</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Recommendations
          </CardTitle>
          <CardDescription>
            Personalized suggestions to improve your communication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {suggestions.map((suggestion: string, index: number) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <div className="mt-0.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                </div>
                <p className="text-sm">{suggestion}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}