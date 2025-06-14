"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@apollo/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Send, RefreshCw } from "lucide-react";
import { GENERATE_SMART_COMPOSE } from "@/graphql/mutations/ai";

interface SmartComposeProps {
  emailId?: string;
  onCompose: (content: string) => void;
  defaultTo?: string;
  defaultSubject?: string;
}

export function SmartEmailComposer({
  emailId,
  onCompose,
  defaultTo,
  defaultSubject,
}: SmartComposeProps) {
  const [prompt, setPrompt] = useState("");
  const [tone, setTone] = useState("professional");
  const [length, setLength] = useState("medium");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState<number>(-1);
  const [fullDraft, setFullDraft] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [generateSmartCompose] = useMutation(GENERATE_SMART_COMPOSE);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      const { data } = await generateSmartCompose({
        variables: {
          input: {
            emailId: emailId || "",
            prompt,
            tone,
            length,
            includeContext: !!emailId,
          },
        },
      });

      if (data?.generateSmartCompose) {
        setSuggestions(data.generateSmartCompose.suggestions || []);
        setFullDraft(data.generateSmartCompose.fullDraft || "");
      }
    } catch (error) {
      console.error("Failed to generate smart compose:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectSuggestion = (index: number) => {
    setSelectedSuggestion(index);
    if (suggestions[index]) {
      onCompose(suggestions[index]);
    }
  };

  const handleUseFullDraft = () => {
    if (fullDraft) {
      onCompose(fullDraft);
    }
  };

  const quickPrompts = [
    "Accept the proposal with enthusiasm",
    "Politely decline but keep the door open",
    "Request more information",
    "Schedule a meeting to discuss",
    "Thank them and provide feedback",
  ];

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">AI Email Composer</h3>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="prompt">What would you like to say?</Label>
          <Textarea
            id="prompt"
            placeholder="E.g., Accept their proposal and suggest next steps..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] mt-2"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((quickPrompt) => (
            <Button
              key={quickPrompt}
              variant="outline"
              size="sm"
              onClick={() => setPrompt(quickPrompt)}
            >
              {quickPrompt}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="tone">Tone</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger id="tone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="casual">Casual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="length">Length</Label>
            <Select value={length} onValueChange={setLength}>
              <SelectTrigger id="length">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="long">Long</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isGenerating}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Email
            </>
          )}
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div className="space-y-3 mt-6">
          <h4 className="font-medium text-sm text-muted-foreground">
            Quick Suggestions
          </h4>
          {suggestions.map((suggestion, index) => (
            <Card
              key={index}
              className={`p-3 cursor-pointer transition-colors ${
                selectedSuggestion === index
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
              onClick={() => handleSelectSuggestion(index)}
            >
              <p className="text-sm">{suggestion}</p>
            </Card>
          ))}
        </div>
      )}

      {fullDraft && (
        <div className="space-y-3 mt-6">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-muted-foreground">
              Full Draft
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Regenerate
            </Button>
          </div>
          <Card className="p-4">
            <pre className="whitespace-pre-wrap text-sm font-sans">
              {fullDraft}
            </pre>
            <Button
              onClick={handleUseFullDraft}
              size="sm"
              className="mt-4"
            >
              <Send className="h-4 w-4 mr-2" />
              Use This Draft
            </Button>
          </Card>
        </div>
      )}
    </Card>
  );
}