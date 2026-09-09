/**
 * Biometric Matching Unit Tests
 * Verifies 128-D vector Euclidean distance, matching boundaries, and confidence scoring.
 */

function calculateEuclideanDistance(desc1, desc2) {
  if (!desc1 || !desc2 || desc1.length !== desc2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < desc1.length; i++) {
    const diff = desc1[i] - desc2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function verifyBiometricsMath(desc1, desc2, threshold = 0.55) {
  const dist = calculateEuclideanDistance(desc1, desc2);
  const matched = dist <= threshold;
  const confidence = Math.max(0, Math.min(100, Math.round((1 - dist / 0.68) * 100)));
  return { matched, distance: parseFloat(dist.toFixed(3)), confidence };
}

function computeLuminance(r, g, b) {
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

let passed = 0;
let total = 0;

function assert(condition, name) {
  total++;
  if (condition) {
    console.log(`  ✔ PASS: ${name}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${name}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================================');
console.log('  BIOMETRIC MATCHING & EUCLIDEAN DISTANCE TESTS');
console.log('======================================================================');

// 1. Identical Descriptors
const vecA = new Float32Array(128).fill(0.15);
const vecIdentical = new Float32Array(128).fill(0.15);
const res1 = verifyBiometricsMath(vecA, vecIdentical, 0.55);
assert(res1.distance === 0, 'Identical face vectors yield distance = 0.00');
assert(res1.matched === true, 'Identical face vectors match = true');
assert(res1.confidence === 100, 'Identical face vectors have 100% confidence');

// 2. High Similarity (Same Person in Different Lighting)
const vecSamePerson = new Float32Array(vecA);
for (let i = 0; i < 128; i++) {
  vecSamePerson[i] += (i % 2 === 0 ? 0.025 : -0.025);
}
const res2 = verifyBiometricsMath(vecA, vecSamePerson, 0.55);
assert(res2.distance > 0 && res2.distance < 0.45, `Distance (${res2.distance}) is well within 0.55 threshold`);
assert(res2.matched === true, 'Same person with slight variation matches successfully');
assert(res2.confidence > 50, `Match confidence is high (${res2.confidence}%)`);

// 3. Boundary Tests (Threshold = 0.55)
// Create vector exactly near 0.55 threshold
const vecNearBoundary = new Float32Array(vecA);
const delta = 0.54 / Math.sqrt(128);
for (let i = 0; i < 128; i++) vecNearBoundary[i] += delta;
const resNear = verifyBiometricsMath(vecA, vecNearBoundary, 0.55);
assert(resNear.distance <= 0.55, `Near-boundary vector (${resNear.distance}) <= 0.55`);
assert(resNear.matched === true, 'Passes at distance <= 0.55');

const vecOverBoundary = new Float32Array(vecA);
const deltaOver = 0.58 / Math.sqrt(128);
for (let i = 0; i < 128; i++) vecOverBoundary[i] += deltaOver;
const resOver = verifyBiometricsMath(vecA, vecOverBoundary, 0.55);
assert(resOver.distance > 0.55, `Over-boundary vector (${resOver.distance}) > 0.55`);
assert(resOver.matched === false, 'Strictly rejects at distance > 0.55');

// 4. Different Person (Far Distance)
const vecDifferentPerson = new Float32Array(vecA);
for (let i = 0; i < 128; i++) vecDifferentPerson[i] += (i % 2 === 0 ? 0.09 : -0.09);
const resDifferent = verifyBiometricsMath(vecA, vecDifferentPerson, 0.55);
assert(resDifferent.matched === false, `Different person (${resDifferent.distance}) is rejected`);
assert(resDifferent.confidence === 0 || resDifferent.confidence < 20, 'Confidence for mismatch is low or 0%');

// 5. Edge Cases
assert(calculateEuclideanDistance(null, vecA) === Infinity, 'Null descriptor returns Infinity distance');
assert(calculateEuclideanDistance(new Float32Array(64), vecA) === Infinity, 'Mismatched vector length returns Infinity distance');

// 6. Luminance Quality Checks
assert(computeLuminance(0, 0, 0) === 0, 'Pure black frame luminance is 0 (tooDark)');
assert(computeLuminance(255, 255, 255) === 255, 'Pure white frame luminance is 255 (tooBright)');
const midLum = computeLuminance(128, 128, 128);
assert(midLum > 30 && midLum < 240, `Neutral gray frame luminance (${midLum}) is in acceptable range (30-240)`);

console.log('======================================================================');
console.log(`  Tests Passed: ${passed} / ${total} (${((passed / total) * 100).toFixed(1)}%)`);
console.log('======================================================================\n');
