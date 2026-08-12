/**
 * Run: node --test server/services/citrineosRemoteCommand.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  pickRemoteConfirmation,
  isRemoteCommandAccepted,
  remoteCommandFailureMessage,
  shouldFallbackToOcpp201,
} from './citrineosServer.mjs';

describe('remote OCPP confirmation helpers', () => {
  it('picks first array entry or single object', () => {
    assert.equal(pickRemoteConfirmation(null), null);
    assert.deepEqual(pickRemoteConfirmation([{ success: true }]), { success: true });
    assert.deepEqual(pickRemoteConfirmation({ success: false, status: 'Rejected' }), {
      success: false,
      status: 'Rejected',
    });
    assert.equal(pickRemoteConfirmation([]), null);
  });

  it('accepts success:true and status/payload Accepted', () => {
    assert.equal(isRemoteCommandAccepted([{ success: true }]), true);
    assert.equal(isRemoteCommandAccepted({ status: 'Accepted' }), true);
    assert.equal(isRemoteCommandAccepted({ payload: 'Accepted' }), true);
    assert.equal(isRemoteCommandAccepted({ success: false, status: 'Rejected' }), false);
    assert.equal(isRemoteCommandAccepted(null), false);
    assert.equal(isRemoteCommandAccepted('Accepted'), false);
  });

  it('falls back to 2.0.1 on null/reject but not on accept', () => {
    // Previous bug: only null/throw triggered fallback; Rejected HTTP-200 did not.
    assert.equal(shouldFallbackToOcpp201(null), true);
    assert.equal(shouldFallbackToOcpp201([{ success: false, payload: 'Rejected' }]), true);
    assert.equal(shouldFallbackToOcpp201({ status: 'Rejected' }), true);
    assert.equal(shouldFallbackToOcpp201([{ success: true }]), false);
    assert.equal(shouldFallbackToOcpp201({ status: 'Accepted' }), false);
  });

  it('prefers payload then status for failure message', () => {
    assert.equal(
      remoteCommandFailureMessage({ payload: 'No transaction', status: 'Rejected' }, 'x'),
      'No transaction'
    );
    assert.equal(remoteCommandFailureMessage({ status: 'Rejected' }, 'x'), 'Rejected');
    assert.equal(remoteCommandFailureMessage(null, 'Stoppen fehlgeschlagen'), 'Stoppen fehlgeschlagen');
  });
});
