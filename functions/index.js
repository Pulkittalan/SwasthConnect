const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

// ==================== TEST FUNCTION ====================
exports.ping = functions.https.onRequest((req, res) => {
  res.status(200).json({
    success: true,
    message: "Firebase Functions are working!",
    timestamp: new Date().toISOString(),
  });
});

// ==================== VIDEO CALL FUNCTIONS ====================

exports.generateVideoToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to make a video call",
    );
  }

  const {roomId, userId, userName, userType} = data;

  if (!roomId || !userId) {
    throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing required fields: roomId and userId are required",
    );
  }

  try {
    const callRef = admin.firestore().collection("calls").doc(roomId);
    await callRef.set({
      roomId: roomId,
      initiator: userId,
      initiatorName: userName,
      initiatorType: userType,
      status: "waiting",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true, roomId: roomId};
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Unable to create call.");
  }
});

exports.endVideoCall = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Auth required.");
  }

  const {roomId, duration} = data;
  if (!roomId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing roomId");
  }

  try {
    const callRef = admin.firestore().collection("calls").doc(roomId);
    await callRef.update({
      status: "ended",
      duration: duration || 0,
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await admin.firestore().collection("callHistory").add({
      roomId: roomId,
      duration: duration || 0,
      userId: context.auth.uid,
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {success: true};
  } catch (error) {
    throw new functions.https.HttpsError("internal", "Error ending call.");
  }
});

// ==================== CHAT FUNCTIONS ====================

// ==================== CHAT FUNCTIONS ====================

exports.onNewMessage = functions.firestore
  .document('chats/{chatId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => {
    const message = snapshot.data();
    const chatId = context.params.chatId;

    try {
      const chatRef = admin.firestore().collection('chats').doc(chatId);
      const chatDoc = await chatRef.get();

      if (!chatDoc.exists) return;

      const chatData = chatDoc.data();
      await chatRef.update({
        lastMessage: message.text || 'Sent an attachment',
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        lastSenderId: message.senderId,
      });

      if (chatData.participants && chatData.participants.length === 2) {
        const otherParticipant = message.senderId === chatData.participants[0]
          ? chatData.participants[1]
          : chatData.participants[0];

        const unreadCountPath = `unreadCount.${otherParticipant}`;
        await chatRef.update({
          [unreadCountPath]: admin.firestore.FieldValue.increment(1),
        });
      }
    } catch (error) {
      console.error('Error in onNewMessage:', error);
    }
  });

// ==================== USER MANAGEMENT ====================

exports.createUserProfile = functions.auth.user().onCreate(async (user) => {
  try {
    const userRef = admin.firestore().collection("users").doc(user.uid);
    await userRef.set({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(error);
  }
});

// FIXED: Removed invalid 'context' argument from auth.user().onUpdate
exports.updateUserProfile = functions.auth.user().onUpdate(async (change) => {
  const user = change.after; // In v1, onUpdate provides a Change object
  try {
    const userRef = admin.firestore().collection("users").doc(user.uid);
    await userRef.update({
      displayName: user.displayName || "",
      photoURL: user.photoURL || "",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(error);
  }
});

exports.deleteUserData = functions.auth.user().onDelete(async (user) => {
  try {
    const batch = admin.firestore().batch();
    batch.delete(admin.firestore().collection("users").doc(user.uid));

    const appointments = await admin.firestore().collection("appointments")
        .where("userId", "==", user.uid).get();
    appointments.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();
  } catch (error) {
    console.error(error);
  }
});

// ==================== CLEANUP FUNCTIONS ====================

exports.cleanupOldCalls = functions.pubsub.schedule("0 * * * *")
    .onRun(async () => {
      const oneHourAgo = new Date(Date.now() - 3600000);
      const oldCalls = await admin.firestore().collection("calls")
          .where("createdAt", "<", oneHourAgo).get();

      const batch = admin.firestore().batch();
      oldCalls.forEach((doc) => batch.delete(doc.ref));
      return batch.commit();
    });

exports.cleanupOldHistory = functions.pubsub.schedule("0 0 * * *")
    .onRun(async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const oldHistory = await admin.firestore().collection("callHistory")
          .where("endedAt", "<", thirtyDaysAgo).get();

      const batch = admin.firestore().batch();
      oldHistory.forEach((doc) => batch.delete(doc.ref));
      return batch.commit();
    });
