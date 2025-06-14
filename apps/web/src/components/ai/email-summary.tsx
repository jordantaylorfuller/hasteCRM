"use client";

import { useState } from "react";
import { useQuery } from "@apollo/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, Target, RefreshCw } from "lucide-react";
import { SUMMARIZE_EMAIL } from "@/graphql/queries/ai";

interface EmailSummaryProps {
  emailId: string;
  isThread?: boolean;
}

export function EmailSummary({ emailId, isThread = false }: EmailSummaryProps) {
  const [includeActionItems, setIncludeActionItems] = useState(true);
  const [includeKeyPoints, setIncludeKeyPoints] = useState(true);

  const { data, loading, error, refetch } = useQuery(SUMMARIZE_EMAIL, {
    variables: {
      input: {
        emailId,
        includeActionItems,
        includeKeyPoints,
        maxLength: 500,
      },
    },
  });

  const summary = data?.summarizeEmail;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">
            Unable to generate summary
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            AI Summary {isThread && <Badge variant="secondary">Thread</Badge>}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Summary
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary.summary}
          </p>
        </div>

        {/* Action Items */}
        {summary.actionItems && summary.actionItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-muted-foreground" />
              Action Items
            </div>
            <ul className="space-y-1">
              {summary.actionItems.map((item: string, index: number) => (
                <li
                  key={index}
                  className="text-sm text-muted-foreground flex items-start gap-2"
                >
                  <span className="text-primary mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Points */}
        {summary.keyPoints && summary.keyPoints.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              Key Points
            </div>
            <div className="flex flex-wrap gap-2">
              {summary.keyPoints.map((point: string, index: number) => (
                <Badge key={index} variant="outline">
                  {point}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
