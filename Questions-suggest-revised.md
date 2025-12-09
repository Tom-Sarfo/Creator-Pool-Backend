# Question Suggestions UI - Revised Implementation Guide

## Overview

This document provides revised frontend implementation instructions for the Question Suggestions feature in the Pool Creation flow. The UI has been updated to better handle new creators and provide clearer guidance.

## Key Changes

1. **Remove "AI Generated" text** - This label should not appear for any suggestions
2. **Show analytics context only for tracked creators** - Display "Based on your avg. X views/week" only when `hasEnoughData: true` or `sampleSize > 0`
3. **New creator fallback** - For creators with no tracked videos, show an input field with sample suggestions as guidance

## API Response Structure

The API endpoint `GET /pools/creators/:creatorId/suggestions` returns:

```typescript
interface SuggestionResponse {
  suggestions: QuestionSuggestion[];
  analytics: {
    avg24hViews: number | null;
    avg48hViews: number | null;
    avg7dViews: number | null;
    avg30dViews: number | null;
    sampleSize: number;
    hasEnoughData: boolean;
  };
  creatorStats: {
    totalVideos: number;
    videosWithMilestones: number;
  };
}

interface QuestionSuggestion {
  question: string;
  targetViews: number;
  trackingDurationDays: number;
  description: string;
  type: "comparison" | "average";
}
```

## UI Implementation by Scenario

### Scenario 1: New Creator (No Tracked Videos)

**API Response:**
```json
{
  "suggestions": [],
  "analytics": {
    "avg24hViews": null,
    "avg48hViews": null,
    "avg7dViews": null,
    "avg30dViews": null,
    "sampleSize": 0,
    "hasEnoughData": false
  },
  "creatorStats": {
    "totalVideos": 0,
    "videosWithMilestones": 0
  }
}
```

**UI Display:**
- Show a text input field for manual question entry
- Display sample suggestions below the input as guidance
- Do NOT show "AI Generated" label
- Do NOT show analytics context (no "Based on your avg..." text)

**Sample Suggestions to Display:**
```
Sample Questions (for guidance):
• Will this video reach 1,000 views within 24 hours?
• Will this video reach 10,000 views within 7 days?
• Will this video get more than 500 likes in the first 48 hours?
• Will this video reach 50,000 views within 30 days?
• Will this video have more than 200 comments in 7 days?
```

**Implementation Example:**
```tsx
function PredictionQuestionSection({ creatorId }: { creatorId: string }) {
  const [customQuestion, setCustomQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<QuestionSuggestion[]>([]);
  const [analytics, setAnalytics] = useState<SuggestionResponse['analytics'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuggestions();
  }, [creatorId]);

  const fetchSuggestions = async () => {
    try {
      const response = await fetch(
        `/api/pools/creators/${creatorId}/suggestions`,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data: SuggestionResponse = await response.json();
      setSuggestions(data.suggestions);
      setAnalytics(data.analytics);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  const sampleSuggestions = [
    "Will this video reach 1,000 views within 24 hours?",
    "Will this video reach 10,000 views within 7 days?",
    "Will this video get more than 500 likes in the first 48 hours?",
    "Will this video reach 50,000 views within 30 days?",
    "Will this video have more than 200 comments in 7 days?",
  ];

  const hasTrackedMetrics = analytics && (analytics.hasEnoughData || analytics.sampleSize > 0);
  const isNewCreator = suggestions.length === 0 && (!analytics || analytics.sampleSize === 0);

  if (loading) {
    return <SuggestionsLoadingSkeleton />;
  }

  return (
    <div className="prediction-question-section">
      <div className="section-header">
        <h3>Prediction Question</h3>
        {!isNewCreator && (
          <button 
            onClick={fetchSuggestions}
            className="regenerate-button"
            aria-label="Regenerate suggestions"
          >
            <RefreshIcon />
            Regenerate
          </button>
        )}
      </div>

      {isNewCreator ? (
        // New Creator: Input Field + Sample Suggestions
        <>
          <div className="question-input-container">
            <label htmlFor="custom-question">Enter your prediction question</label>
            <input
              id="custom-question"
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="e.g., Will this video reach 10,000 views within 7 days?"
              className="question-input"
            />
          </div>

          <div className="sample-suggestions-container">
            <p className="sample-suggestions-title">
              Sample Questions (for guidance):
            </p>
            <ul className="sample-suggestions-list">
              {sampleSuggestions.map((sample, index) => (
                <li 
                  key={index}
                  className="sample-suggestion-item"
                  onClick={() => setCustomQuestion(sample)}
                >
                  {sample}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        // Existing Creator: Show Suggestions
        <>
          {suggestions.length > 0 && (
            <div className="suggestions-container">
              {/* Primary Suggestion */}
              <div className="primary-suggestion-card">
                <div className="suggestion-content">
                  <p className="suggestion-question">
                    {suggestions[0].question}
                  </p>
                  {hasTrackedMetrics && analytics && (
                    <p className="suggestion-context">
                      <LightbulbIcon />
                      Based on your avg. {formatViews(analytics.avg7dViews || analytics.avg24hViews || 0)} views/week
                    </p>
                  )}
                </div>
              </div>

              {/* Alternative Suggestions */}
              {suggestions.length > 1 && (
                <>
                  <p className="alternatives-title">
                    Or choose from these alternatives:
                  </p>
                  <div className="alternatives-grid">
                    {suggestions.slice(1).map((suggestion, index) => (
                      <div
                        key={index}
                        className="alternative-suggestion-card"
                        onClick={() => handleSelectSuggestion(suggestion)}
                      >
                        {suggestion.question}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

### Scenario 2: Creator with Tracked Metrics (hasEnoughData: true)

**API Response:**
```json
{
  "suggestions": [
    {
      "question": "Will this video reach 15.3K views in the first 24 hours?",
      "targetViews": 15300,
      "trackingDurationDays": 1,
      "description": "Based on your average of 15.3K views in 24 hours",
      "type": "average"
    }
  ],
  "analytics": {
    "avg24hViews": 15300,
    "avg48hViews": 22100,
    "avg7dViews": 45200,
    "avg30dViews": 89200,
    "sampleSize": 15,
    "hasEnoughData": true
  },
  "creatorStats": {
    "totalVideos": 23,
    "videosWithMilestones": 15
  }
}
```

**UI Display:**
- Show primary suggestion in highlighted card
- Display analytics context: "Based on your avg. X views/week" (use `avg7dViews` if available, otherwise `avg24hViews`)
- Show alternative suggestions below
- Do NOT show "AI Generated" label
- Show "Regenerate" button in header

### Scenario 3: Creator with Limited Data (hasEnoughData: false, but has suggestions)

**API Response:**
```json
{
  "suggestions": [
    {
      "question": "Will this video get more views than your last video? (Last: 5.2K)",
      "targetViews": 5720,
      "trackingDurationDays": 7,
      "description": "10% above your last video's performance",
      "type": "comparison"
    }
  ],
  "analytics": {
    "avg24hViews": null,
    "avg48hViews": null,
    "avg7dViews": null,
    "avg30dViews": null,
    "sampleSize": 2,
    "hasEnoughData": false
  },
  "creatorStats": {
    "totalVideos": 3,
    "videosWithMilestones": 0
  }
}
```

**UI Display:**
- Show suggestions normally
- Do NOT show analytics context (no "Based on your avg..." text) since `hasEnoughData: false` and averages are null
- Do NOT show "AI Generated" label
- Show "Regenerate" button

## Helper Functions

```typescript
// Format views for display (e.g., 15300 -> "15.3K", 892000 -> "892K")
function formatViews(views: number): string {
  if (views >= 1000000) {
    return (views / 1000000).toFixed(1) + "M";
  }
  if (views >= 1000) {
    return (views / 1000).toFixed(1) + "K";
  }
  return views.toString();
}

// Determine if creator has tracked metrics
function hasTrackedMetrics(analytics: SuggestionResponse['analytics'] | null): boolean {
  if (!analytics) return false;
  return analytics.hasEnoughData || analytics.sampleSize > 0;
}

// Determine if creator is new (no tracked videos)
function isNewCreator(
  suggestions: QuestionSuggestion[],
  analytics: SuggestionResponse['analytics'] | null
): boolean {
  return suggestions.length === 0 && (!analytics || analytics.sampleSize === 0);
}
```

## Styling Guidelines

### Input Field (New Creators)
```css
.question-input-container {
  margin-bottom: 24px;
}

.question-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e5e7eb;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 0.2s;
}

.question-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.sample-suggestions-container {
  margin-top: 24px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 8px;
}

.sample-suggestions-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 12px;
}

.sample-suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.sample-suggestion-item {
  padding: 12px;
  margin-bottom: 8px;
  background-color: white;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: #374151;
}

.sample-suggestion-item:hover {
  border-color: #3b82f6;
  background-color: #eff6ff;
}
```

### Primary Suggestion Card
```css
.primary-suggestion-card {
  padding: 20px;
  background-color: #ecfdf5; /* Light teal/green */
  border-radius: 8px;
  border: 2px solid #10b981;
  margin-bottom: 24px;
}

.suggestion-question {
  font-size: 18px;
  font-weight: 600;
  color: #065f46;
  margin-bottom: 8px;
}

.suggestion-context {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #047857;
  margin-top: 8px;
}
```

### Alternative Suggestions
```css
.alternatives-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 12px;
}

.alternatives-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
}

.alternative-suggestion-card {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: white;
}

.alternative-suggestion-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```

## Component States Summary

| Scenario | Suggestions | Analytics | UI Display |
|----------|-------------|-----------|------------|
| New Creator | `[]` | `sampleSize: 0` | Input field + Sample suggestions |
| Limited Data | `[...]` | `hasEnoughData: false`, `sampleSize: 2-9` | Suggestions without analytics context |
| Tracked Metrics | `[...]` | `hasEnoughData: true`, `sampleSize: 10+` | Suggestions with "Based on avg..." context |

## Important Notes

1. **Never show "AI Generated" label** - This has been removed from all scenarios
2. **Analytics context is conditional** - Only show "Based on your avg. X views/week" when:
   - `hasEnoughData: true` OR
   - `sampleSize > 0` AND at least one average value is not null
3. **New creators get manual input** - Always show input field when `suggestions.length === 0` and `sampleSize === 0`
4. **Sample suggestions are clickable** - Clicking a sample suggestion should populate the input field
5. **Regenerate button** - Only show for creators with suggestions (not new creators)

## Testing Checklist

- [ ] New creator (0 videos) sees input field with sample suggestions
- [ ] New creator does NOT see "AI Generated" label
- [ ] New creator does NOT see analytics context
- [ ] Creator with tracked metrics sees "Based on avg..." text
- [ ] Creator with limited data sees suggestions but no analytics context
- [ ] Sample suggestions are clickable and populate input
- [ ] Regenerate button only appears for creators with suggestions
- [ ] Primary suggestion is highlighted appropriately
- [ ] Alternative suggestions display correctly in grid

## API Integration Example

```typescript
// Complete component example
import { useState, useEffect } from 'react';

interface QuestionSuggestion {
  question: string;
  targetViews: number;
  trackingDurationDays: number;
  description: string;
  type: "comparison" | "average";
}

interface SuggestionResponse {
  suggestions: QuestionSuggestion[];
  analytics: {
    avg24hViews: number | null;
    avg48hViews: number | null;
    avg7dViews: number | null;
    avg30dViews: number | null;
    sampleSize: number;
    hasEnoughData: boolean;
  };
  creatorStats: {
    totalVideos: number;
    videosWithMilestones: number;
  };
}

export function PredictionQuestionSection({ creatorId }: { creatorId: string }) {
  const [customQuestion, setCustomQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<QuestionSuggestion[]>([]);
  const [analytics, setAnalytics] = useState<SuggestionResponse['analytics'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [creatorId]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/pools/creators/${creatorId}/suggestions`,
        {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch suggestions');
      }

      const data: SuggestionResponse = await response.json();
      setSuggestions(data.suggestions);
      setAnalytics(data.analytics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) {
      return (views / 1000000).toFixed(1) + "M";
    }
    if (views >= 1000) {
      return (views / 1000).toFixed(1) + "K";
    }
    return views.toString();
  };

  const hasTrackedMetrics = analytics && (analytics.hasEnoughData || analytics.sampleSize > 0);
  const isNewCreator = suggestions.length === 0 && (!analytics || analytics.sampleSize === 0);
  const avgViews = analytics?.avg7dViews || analytics?.avg24hViews || 0;

  const sampleSuggestions = [
    "Will this video reach 1,000 views within 24 hours?",
    "Will this video reach 10,000 views within 7 days?",
    "Will this video get more than 500 likes in the first 48 hours?",
    "Will this video reach 50,000 views within 30 days?",
    "Will this video have more than 200 comments in 7 days?",
  ];

  if (loading) {
    return <div>Loading suggestions...</div>;
  }

  if (error) {
    return (
      <div className="error-message">
        <p>Unable to load suggestions: {error}</p>
        <button onClick={fetchSuggestions}>Retry</button>
      </div>
    );
  }

  return (
    <div className="prediction-question-section">
      <div className="section-header">
        <h3>Prediction Question</h3>
        {!isNewCreator && (
          <button 
            onClick={fetchSuggestions}
            className="regenerate-button"
            aria-label="Regenerate suggestions"
          >
            <RefreshIcon />
            Regenerate
          </button>
        )}
      </div>

      {isNewCreator ? (
        <>
          <div className="question-input-container">
            <label htmlFor="custom-question">Enter your prediction question</label>
            <input
              id="custom-question"
              type="text"
              value={customQuestion}
              onChange={(e) => setCustomQuestion(e.target.value)}
              placeholder="e.g., Will this video reach 10,000 views within 7 days?"
              className="question-input"
            />
          </div>

          <div className="sample-suggestions-container">
            <p className="sample-suggestions-title">
              Sample Questions (for guidance):
            </p>
            <ul className="sample-suggestions-list">
              {sampleSuggestions.map((sample, index) => (
                <li 
                  key={index}
                  className="sample-suggestion-item"
                  onClick={() => setCustomQuestion(sample)}
                >
                  {sample}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        <>
          {suggestions.length > 0 && (
            <div className="suggestions-container">
              <div className="primary-suggestion-card">
                <div className="suggestion-content">
                  <p className="suggestion-question">
                    {suggestions[0].question}
                  </p>
                  {hasTrackedMetrics && avgViews > 0 && (
                    <p className="suggestion-context">
                      <LightbulbIcon />
                      Based on your avg. {formatViews(avgViews)} views/week
                    </p>
                  )}
                </div>
              </div>

              {suggestions.length > 1 && (
                <>
                  <p className="alternatives-title">
                    Or choose from these alternatives:
                  </p>
                  <div className="alternatives-grid">
                    {suggestions.slice(1).map((suggestion, index) => (
                      <div
                        key={index}
                        className="alternative-suggestion-card"
                        onClick={() => handleSelectSuggestion(suggestion)}
                      >
                        {suggestion.question}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

## Summary

The key changes are:
1. **Remove "AI Generated" text** completely
2. **Show input field for new creators** with sample suggestions as guidance
3. **Conditionally show analytics context** only when `hasTrackedMetrics` is true
4. **Maintain existing suggestion display** for creators with tracked data

This provides a better onboarding experience for new creators while maintaining the intelligent suggestions for established creators.


