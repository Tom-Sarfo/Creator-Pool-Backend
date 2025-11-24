# Question Suggestion System - Frontend Integration Guide

## Overview

This guide explains how to integrate the question suggestion system into your frontend. The system automatically generates pool question suggestions for creators based on their historical video performance data.

## API Endpoint

### GET /pools/creators/:creatorId/suggestions

**Authentication**: Required (JWT token)  
**Authorization**: Creator or Admin role required

**Query Parameters**:

- `videoId` (optional): Video ID for context (currently unused but reserved for future use)

**Example Request**:

```typescript
GET /pools/creators/{creatorId}/suggestions?videoId={optionalVideoId}
Authorization: Bearer {jwt_token}
```

## Response Structure

```typescript
interface SuggestionResponse {
  suggestions: Array<{
    question: string; // The suggested question text
    targetViews: number; // Target view count for the pool
    trackingDurationDays: number; // How long to track (1, 2, 7, or 30 days)
    description: string; // Explanation of the suggestion basis
    type: "comparison" | "average"; // Suggestion type
  }>;
  analytics: {
    avg24hViews: number | null; // Average views in 24 hours
    avg48hViews: number | null; // Average views in 48 hours
    avg7dViews: number | null; // Average views in 7 days
    avg30dViews: number | null; // Average views in 30 days
    sampleSize: number; // Number of videos used for calculation
    hasEnoughData: boolean; // true if >=10 videos with milestone data
  };
  creatorStats: {
    totalVideos: number; // Total public videos
    videosWithMilestones: number; // Videos with milestone data captured
  };
}
```

## When to Use Each Suggestion Type

### Comparison Suggestions (type: 'comparison')

- **When**: Creator has <10 videos with milestone data (`hasEnoughData: false`)
- **Use Case**: New creators joining the platform
- **Examples**:
  - "Will this video get more views than your last video? (Last: 5.2K)"
  - "Will this video reach 6.3K views in 7 days?" (20% growth)
- **Display**: Show these with a badge indicating "Based on your recent videos"

### Average Suggestions (type: 'average')

- **When**: Creator has >=10 videos with milestone data (`hasEnoughData: true`)
- **Use Case**: Established creators with historical data
- **Examples**:
  - "Will this video reach 15.3K views in the first 24 hours?"
  - "Will this video reach 45.2K views in 7 days?"
- **Display**: Show these with a badge indicating "Based on your average performance"

## Frontend Integration Examples

### React/TypeScript Example

```typescript
import { useState, useEffect } from 'react';

interface Suggestion {
  question: string;
  targetViews: number;
  trackingDurationDays: number;
  description: string;
  type: 'comparison' | 'average';
}

interface SuggestionResponse {
  suggestions: Suggestion[];
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

function PoolCreationSuggestions({ creatorId }: { creatorId: string }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [analytics, setAnalytics] = useState<SuggestionResponse['analytics'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [creatorId]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
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

  const handleSelectSuggestion = (suggestion: Suggestion) => {
    // Use the suggestion data to pre-fill the pool creation form
    const poolData = {
      question: suggestion.question,
      targetViews: suggestion.targetViews,
      trackingDurationDays: suggestion.trackingDurationDays,
    };

    // Navigate to pool creation with pre-filled data
    navigate('/pools/create', { state: poolData });
  };

  if (loading) {
    return <SuggestionsLoadingSkeleton />;
  }

  if (error) {
    return (
      <div className="error-message">
        <p>Unable to load suggestions: {error}</p>
        <button onClick={fetchSuggestions}>Retry</button>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <div className="no-suggestions">
        <p>No suggestions available yet. Create your first pool manually!</p>
        <p className="text-sm text-gray-500">
          Suggestions will appear after you have some videos with performance data.
        </p>
      </div>
    );
  }

  return (
    <div className="suggestions-container">
      <div className="suggestions-header">
        <h3>Suggested Questions</h3>
        {analytics && (
          <div className="analytics-badge">
            {analytics.hasEnoughData ? (
              <span className="badge-success">
                Based on {analytics.sampleSize} videos
              </span>
            ) : (
              <span className="badge-info">
                Based on recent videos
              </span>
            )}
          </div>
        )}
      </div>

      <div className="suggestions-grid">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`suggestion-card suggestion-${suggestion.type}`}
            onClick={() => handleSelectSuggestion(suggestion)}
          >
            <div className="suggestion-header">
              <span className={`suggestion-type-badge type-${suggestion.type}`}>
                {suggestion.type === 'average' ? 'Average' : 'Comparison'}
              </span>
            </div>
            <h4 className="suggestion-question">{suggestion.question}</h4>
            <p className="suggestion-description">{suggestion.description}</p>
            <div className="suggestion-details">
              <span className="target-views">
                Target: {formatNumber(suggestion.targetViews)} views
              </span>
              <span className="tracking-duration">
                Track for: {suggestion.trackingDurationDays} day{suggestion.trackingDurationDays !== 1 ? 's' : ''}
              </span>
            </div>
            <button className="btn-use-suggestion">Use This Question</button>
          </div>
        ))}
      </div>

      {analytics && !analytics.hasEnoughData && (
        <div className="data-quality-notice">
          <p className="notice-text">
            💡 You'll get more accurate suggestions after 10 videos with performance data.
            Currently using {analytics.sampleSize} video{analytics.sampleSize !== 1 ? 's' : ''}.
          </p>
        </div>
      )}
    </div>
  );
}

// Helper function to format numbers
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function getAuthToken(): string {
  // Your token retrieval logic
  return localStorage.getItem('authToken') || '';
}
```

## UI/UX Recommendations

### Display Suggestions

1. **Card Layout**: Show suggestions in a grid of cards (2-3 columns on desktop, 1 column on mobile)
2. **Visual Distinction**:
   - Use different colors/borders for `comparison` vs `average` suggestions
   - Add icons: 📊 for average, 📈 for comparison
3. **Information Hierarchy**:
   - Question text (large, prominent)
   - Description (smaller, secondary text)
   - Target views and duration (badges or small text)
   - "Use This Question" button (primary action)

### Empty States

**No Suggestions Available**:

- Show a friendly message: "No suggestions available yet"
- Explain why: "Suggestions will appear after your videos have performance data"
- Provide a manual pool creation button

**No Videos Yet**:

- Guide creators to sync their YouTube channel first
- Show: "Connect your YouTube channel to get personalized suggestions"

### Loading States

- Show skeleton loaders with 3-5 placeholder cards
- Use a subtle spinner or shimmer effect

### Error Handling

1. **Network Errors**:

   - Show retry button
   - Display user-friendly error message
   - Don't block pool creation - allow manual entry

2. **Insufficient Data**:

   - Show comparison suggestions if available
   - Display notice: "More suggestions available after 10 videos"

3. **No Milestone Data**:
   - Show message: "Waiting for video performance data..."
   - Explain: "We'll capture milestone data as your videos age"

## Integration Points

### Pool Creation Flow

```typescript
// When creator clicks "Create Pool"
function PoolCreationPage() {
  const [showSuggestions, setShowSuggestions] = useState(true);

  return (
    <div>
      {showSuggestions && (
        <PoolCreationSuggestions
          creatorId={currentUser.id}
          onSelectSuggestion={(suggestion) => {
            // Pre-fill form fields
            setFormData({
              question: suggestion.question,
              targetViews: suggestion.targetViews,
              trackingDurationDays: suggestion.trackingDurationDays,
            });
            setShowSuggestions(false);
          }}
        />
      )}

      <PoolCreationForm
        initialData={formData}
        onCancel={() => setShowSuggestions(true)}
      />
    </div>
  );
}
```

### Dashboard Integration

```typescript
// Show suggestions preview on creator dashboard
function CreatorDashboard() {
  return (
    <div>
      <QuickActions>
        <CreatePoolButton />
      </QuickActions>

      <SuggestionsPreview
        creatorId={currentUser.id}
        limit={3} // Show top 3 suggestions
      />
    </div>
  );
}
```

## Edge Cases

### 1. Creator with 0 Videos

- **Response**: Empty `suggestions` array
- **Display**: Message: "No suggestions available. Create your first pool manually!"

### 2. Creator with Videos but No Milestone Data Yet

- **Response**: Empty `suggestions` array, `sampleSize: 0`
- **Display**: Message: "We're collecting performance data from your videos. Check back soon!"

### 3. Creator with 1-9 Videos

- **Response**: Comparison suggestions (type: 'comparison')
- **Display**: Show comparison suggestions with info badge

### 4. Creator with 10+ Videos

- **Response**: Average suggestions (type: 'average')
- **Display**: Show average suggestions with confidence badge showing sample size

### 5. Creator with Videos but All Milestones Missing

- **Response**: `hasEnoughData: false`, `sampleSize: 0`
- **Display**: Fallback to comparison if recent videos exist, otherwise show manual creation option

## Styling Recommendations

```css
/* Suggestion Cards */
.suggestion-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  cursor: pointer;
  transition: all 0.2s;
}

.suggestion-card:hover {
  border-color: #3b82f6;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.suggestion-average {
  border-left: 4px solid #10b981; /* Green for averages */
}

.suggestion-comparison {
  border-left: 4px solid #f59e0b; /* Orange for comparison */
}

/* Type Badges */
.suggestion-type-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.type-average {
  background-color: #d1fae5;
  color: #065f46;
}

.type-comparison {
  background-color: #fef3c7;
  color: #92400e;
}

/* Data Quality Notice */
.data-quality-notice {
  margin-top: 24px;
  padding: 12px;
  background-color: #fef3c7;
  border-radius: 6px;
  border-left: 4px solid #f59e0b;
}
```

## API Response Examples

### Example 1: New Creator (<10 videos)

```json
{
  "suggestions": [
    {
      "question": "Will this video get more views than your last video? (Last: 5.2K)",
      "targetViews": 5720,
      "trackingDurationDays": 7,
      "description": "10% above your last video's performance",
      "type": "comparison"
    },
    {
      "question": "Will this video reach 6.2K views in 7 days?",
      "targetViews": 6240,
      "trackingDurationDays": 7,
      "description": "20% growth from your last video",
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
    "videosWithMilestones": 2
  }
}
```

### Example 2: Established Creator (10+ videos)

```json
{
  "suggestions": [
    {
      "question": "Will this video reach 15.3K views in the first 24 hours?",
      "targetViews": 15300,
      "trackingDurationDays": 1,
      "description": "Based on your average of 15.3K views in 24 hours",
      "type": "average"
    },
    {
      "question": "Will this video reach 18.4K views in 24 hours?",
      "targetViews": 18360,
      "trackingDurationDays": 1,
      "description": "20% above your 24-hour average",
      "type": "average"
    },
    {
      "question": "Will this video reach 45.2K views in 7 days?",
      "targetViews": 45200,
      "trackingDurationDays": 7,
      "description": "Based on your average of 45.2K views in 7 days",
      "type": "average"
    },
    {
      "question": "Will this video outperform your 7-day average and reach 67.8K views?",
      "targetViews": 67800,
      "trackingDurationDays": 7,
      "description": "50% above your 7-day average",
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

## Best Practices

1. **Always Allow Manual Entry**: Don't force users to use suggestions
2. **Show Context**: Always display the `description` field to explain why a suggestion was made
3. **Respect User Choice**: If user dismisses suggestions, don't show them again in same session
4. **Update Real-time**: Refetch suggestions when creator syncs new videos
5. **Progressive Enhancement**: Functionality should work without suggestions (manual pool creation always available)

## Testing Checklist

- [ ] Fetch suggestions for creator with 0 videos
- [ ] Fetch suggestions for creator with 1-9 videos (comparison mode)
- [ ] Fetch suggestions for creator with 10+ videos (average mode)
- [ ] Handle network errors gracefully
- [ ] Handle authentication errors
- [ ] Display suggestions correctly on mobile
- [ ] Test suggestion selection and form pre-filling
- [ ] Verify number formatting (K, M suffixes)
- [ ] Test with slow network (loading states)








