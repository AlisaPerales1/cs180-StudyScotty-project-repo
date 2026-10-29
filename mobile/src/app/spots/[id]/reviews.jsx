import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { RATING_MAX, createReview, getSpotSummary, listReviews } from '../../../api/reviews';
import ActionButton from '../../../components/ActionButton';
import Screen from '../../../components/Screen';
import StarRating from '../../../components/StarRating';

/** @param {import('../../../api/reviews').Review[]} reviews */
function summarize(reviews) {
  const counts = [0, 0, 0, 0, 0];
  for (const review of reviews) counts[review.rating - 1] += 1;
  const total = reviews.length;
  const average = total ? reviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;
  return { total, average, counts };
}

/** @param {import('../../../api/reviews').ReviewAuthor} author */
function displayName(author) {
  return [author.first_name, author.last_name].filter(Boolean).join(' ') || `@${author.username}`;
}

/** @param {string} iso */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function SpotReviewsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const spotId = Number(Array.isArray(id) ? id[0] : id);

  const [spot, setSpot] = useState(/** @type {import('../../../api/reviews').SpotSummary | null} */ (null));
  const [reviews, setReviews] = useState(/** @type {import('../../../api/reviews').Review[]} */ ([]));
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getSpotSummary(spotId), listReviews(spotId)])
      .then(([spotData, reviewData]) => {
        if (!active) return;
        setSpot(spotData);
        setReviews(reviewData);
      })
      .catch(() => { if (active) setLoadError('Could not load reviews for this spot.'); });
    return () => { active = false; };
  }, [spotId, loadAttempt]);

  const retryLoad = () => {
    setLoadError('');
    setLoadAttempt((value) => value + 1);
  };

  const submit = async () => {
    if (!rating) {
      setFormError('Choose a rating from 1 to 5 stars.');
      return;
    }
    setFormError('');
    setMessage('');
    setSubmitting(true);
    try {
      const review = await createReview(spotId, { rating, comment });
      setReviews((current) => [review, ...current]);
      setRating(0);
      setComment('');
      setMessage('Thanks! Your review was posted.');
    } catch {
      setFormError('Could not post your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const { total, average, counts } = summarize(reviews);

  return (
    <Screen title={spot ? spot.name : 'Reviews'} subtitle="Ratings and reviews from fellow Highlanders.">
      <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Text style={styles.link}>‹ Back</Text>
      </Pressable>

      {loadError ? (
        <View style={styles.card}>
          <Text>{loadError}</Text>
          <ActionButton title="Try again" onPress={retryLoad} />
        </View>
      ) : !spot ? (
        <ActivityIndicator accessibilityLabel="Loading reviews" />
      ) : (
        <>
          <View style={[styles.card, styles.summary]}>
            <View style={styles.average}>
              <Text style={styles.averageValue}>{total ? average.toFixed(1) : '–'}</Text>
              <StarRating value={average} />
              <Text style={styles.muted}>{total} review{total === 1 ? '' : 's'}</Text>
            </View>
            <View style={styles.bars}>
              {[5, 4, 3, 2, 1].map((star) => (
                <View key={star} style={styles.barRow}
                  accessibilityLabel={`${star} stars: ${counts[star - 1]} reviews`}>
                  <Text style={styles.barLabel}>{star}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { flex: total ? counts[star - 1] / total : 0 }]} />
                    <View style={{ flex: total ? 1 - counts[star - 1] / total : 1 }} />
                  </View>
                  <Text style={styles.barCount}>{counts[star - 1]}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.heading}>Write a review</Text>
            <StarRating value={rating} size={32} onChange={(value) => {
              setRating(value);
              setFormError('');
            }} />
            <Text style={styles.muted}>{rating ? `${rating} of ${RATING_MAX} stars` : 'Tap a star to rate'}</Text>
            <TextInput
              value={comment}
              onChangeText={setComment}
              multiline
              accessibilityLabel="Comment (optional)"
              placeholder="What's it like to study here? (optional)"
              style={styles.input}
            />
            {formError ? <Text style={styles.error}>{formError}</Text> : null}
            <ActionButton title={submitting ? 'Posting…' : 'Post review'} onPress={submit} disabled={submitting} />
            {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
          </View>

          {reviews.length ? reviews.map((review) => (
            <View key={review.id} style={styles.card}>
              <View style={styles.reviewHeader}>
                <Text style={styles.author}>{displayName(review.author)}</Text>
                <Text style={styles.muted}>{formatDate(review.created_at)}</Text>
              </View>
              <StarRating value={review.rating} />
              {review.comment ? <Text style={styles.comment}>{review.comment}</Text> : null}
            </View>
          )) : (
            <Text style={styles.muted}>No reviews yet. Be the first to rate this spot.</Text>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 12, backgroundColor: 'white', borderRadius: 16 },
  link: { color: '#2463a0', fontSize: 16, fontWeight: '600' },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 20 },
  average: { alignItems: 'center', gap: 4, minWidth: 96 },
  averageValue: { fontSize: 40, fontWeight: '700', color: '#142d4e' },
  bars: { flex: 1, minWidth: 160, gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 12, color: '#526277', fontWeight: '600' },
  barTrack: { flex: 1, flexDirection: 'row', height: 8, borderRadius: 4, backgroundColor: '#e5edf6', overflow: 'hidden' },
  barFill: { backgroundColor: '#f2a900' },
  barCount: { width: 24, textAlign: 'right', color: '#526277' },
  heading: { fontSize: 18, fontWeight: '700', color: '#142d4e' },
  input: {
    borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 10, minHeight: 96,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: '#142d4e', textAlignVertical: 'top',
  },
  error: { color: '#c0392b', fontSize: 13 },
  message: { color: '#2463a0' },
  muted: { color: '#7a8797' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  author: { fontSize: 16, fontWeight: '600', color: '#142d4e', flexShrink: 1 },
  comment: { fontSize: 15, color: '#142d4e', lineHeight: 22 },
});
