import Text "mo:base/Text";
import Principal "mo:base/Principal";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Result "mo:base/Result";
import Array "mo:base/Array";
import Types "types/Types";
import UserService "services/UserService";
import RoomService "services/RoomService";
import SignalService "services/SignalService";
import IcWebSocketCdk "mo:ic-websocket-cdk";
import IcWebSocketCdkState "mo:ic-websocket-cdk/State";
import IcWebSocketCdkTypes "mo:ic-websocket-cdk/Types";
import Buffer "mo:base/Buffer";

actor {
  // ===== State =====
  private let connected = Buffer.Buffer<Principal>(0);

  // ===== WS state =====
  private let subsByRoom = HashMap.HashMap<Text, Buffer.Buffer<Principal>>(0, Text.equal, Text.hash);
  private let roomsByClient = HashMap.HashMap<Principal, Buffer.Buffer<Text>>(0, Principal.equal, Principal.hash);

  private var users : Types.Users = HashMap.HashMap(0, Principal.equal, Principal.hash);
  private var rooms : Types.Rooms = HashMap.HashMap(0, Text.equal, Text.hash);
  private var signals : Types.Signals = HashMap.HashMap(0, Text.equal, Text.hash);

  private stable var stableUsers : [(Principal, Types.User)] = [];
  private stable var stableRooms : [(Text, Types.Room)] = [];
  private stable var stableSignals : [(Text, [Types.Signal])] = [];

  system func preupgrade() {
    stableUsers := Iter.toArray(users.entries());
    stableRooms := Iter.toArray(rooms.entries());
    stableSignals := Iter.toArray(signals.entries());
  };

  system func postupgrade() {
    users := HashMap.fromIter<Principal, Types.User>(stableUsers.vals(), 0, Principal.equal, Principal.hash);
    rooms := HashMap.fromIter<Text, Types.Room>(stableRooms.vals(), 0, Text.equal, Text.hash);
    signals := HashMap.fromIter<Text, [Types.Signal]>(stableSignals.vals(), 0, Text.equal, Text.hash);
    stableUsers := [];
    stableRooms := [];
    stableSignals := [];
  };

  // USER
  public query (message) func whoami() : async Principal {
    message.caller;
  };

  public shared (message) func authenticateUser(username : Text) : async Result.Result<Types.User, Text> {
    return UserService.authenticateUser(users, message.caller, username);
  };

  public shared (message) func updateUserProfile(updateData : Types.UserUpdateData) : async Result.Result<Types.User, Text> {
    return UserService.updateUserProfile(users, message.caller, updateData);
  };

  public shared (message) func setMyOutfit(outfitSlots : [Text]) : async Result.Result<Types.User, Text> {
    return UserService.setUserOutfit(users, message.caller, outfitSlots);
  };

  public query func getUserOutfit(userId : Principal) : async [Text] {
    return UserService.getUserOutfit(users, userId);
  };

  public query func getUserByUsername(username : Text) : async ?Types.User {
    return UserService.getUserByUsername(users, username);
  };

  public query func getUserByPrincipal(userId : Principal) : async ?Types.User {
    return users.get(userId);
  };

  // ROOM
  public shared (msg) func createRoom(roomId : Text) : async Result.Result<Types.Room, Text> {
    RoomService.createRoom(rooms, roomId, msg.caller);
  };

  public shared (msg) func joinRoom(roomId : Text) : async Result.Result<Types.Room, Text> {
    let res = RoomService.joinRoom(rooms, roomId, msg.caller);
    switch (res) {
      case (#ok(_)) {
        await pushJoined(roomId, msg.caller);
        await pushParticipants(roomId, null);
      };
      case (_) {};
    };
    res;
  };

  public query func getRoom(roomId : Text) : async ?Types.Room {
    RoomService.getRoom(rooms, roomId);
  };

  public shared (msg) func leaveRoom(roomId : Text) : async Result.Result<Types.Room, Text> {
    let res = RoomService.leaveRoom(rooms, roomId, msg.caller);
    switch (res) {
      case (#ok(_)) {
        await pushLeft(roomId, msg.caller);
        await pushParticipants(roomId, null);
      };
      case (_) {};
    };
    res;
  };

  // SIGNAL
  public shared (_msg) func sendSignal(roomId : Text, signal : Types.Signal) : async () {
    SignalService.sendSignal(signals, roomId, signal);
  };

  public query func getSignals(roomId : Text, to : Principal) : async [Types.Signal] {
    SignalService.getSignals(signals, roomId, to);
  };

  public shared (msg) func clearSignals(roomId : Text) : async () {
    SignalService.clearSignals(signals, roomId, msg.caller);
  };

  // HELPER (DEV)
  public query func listAllRooms() : async [Types.Room] {
    Iter.toArray(rooms.vals());
  };

  public query func listAllSignals() : async [Types.Signal] {
    var allSignals : [Types.Signal] = [];
    for ((roomId, signalList) in signals.entries()) {
      allSignals := Array.append<Types.Signal>(allSignals, signalList);
    };
    return allSignals;
  };

  public func debugSignals(roomId : Text) : async [Types.Signal] {
    let roomSignals = signals.get(roomId);
    switch (roomSignals) {
      case (null) {
        return [];
      };
      case (?sigList) {
        return sigList;
      };
    };
  };

  // HELPER (DEV): RESET ROOMS
  // public shared (_msg) func resetAllRooms() : async () {
  //     rooms := HashMap.HashMap(0, Text.equal, Text.hash);
  // };

  // HELPER (DEV): RESET SIGNALS
  public shared (_msg) func resetAllSignals() : async () {
    signals := HashMap.HashMap(0, Text.equal, Text.hash);
  };

  // WS
  // ===== Helpers: subs =====
  func addSub(cp : Principal, roomId : Text) {
    let buf = switch (subsByRoom.get(roomId)) {
      case (?b) b;
      case (null) {
        let b = Buffer.Buffer<Principal>(0);
        subsByRoom.put(roomId, b);
        b;
      };
    };
    if (Buffer.indexOf<Principal>(cp, buf, Principal.equal) == null) {
      buf.add(cp);
    };

    let rb = switch (roomsByClient.get(cp)) {
      case (?b) b;
      case (null) {
        let b = Buffer.Buffer<Text>(0);
        roomsByClient.put(cp, b);
        b;
      };
    };
    if (Buffer.indexOf<Text>(roomId, rb, Text.equal) == null) { rb.add(roomId) };
  };

  func removeSub(cp : Principal, roomId : Text) {
    switch (subsByRoom.get(roomId)) {
      case (?b) {
        switch (Buffer.indexOf<Principal>(cp, b, Principal.equal)) {
          case (?i) { ignore b.remove(i) };
          case (null) {};
        };
        if (b.size() == 0) { ignore subsByRoom.remove(roomId) };
      };
      case (null) {};
    };
    switch (roomsByClient.get(cp)) {
      case (?rb) {
        switch (Buffer.indexOf<Text>(roomId, rb, Text.equal)) {
          case (?i) { ignore rb.remove(i) };
          case (null) {};
        };
        if (rb.size() == 0) { ignore roomsByClient.remove(cp) };
      };
      case (null) {};
    };
  };

  // ===== Helpers: send =====
  func sendWs(cp : Principal, msg : Types.WsMessage) : async () {
    ignore await IcWebSocketCdk.send(ws_state, cp, to_candid (msg));
  };

  func sendToRoom(roomId : Text, msg : Types.WsMessage) : async () {
    switch (subsByRoom.get(roomId)) {
      case (?b) {
        let arr = Buffer.toArray(b);
        for (cp in arr.vals()) { await sendWs(cp, msg) };
      };
      case (null) {};
    };
  };

  func sendToRoomExcept(roomId : Text, except : Principal, msg : Types.WsMessage) : async () {
    switch (subsByRoom.get(roomId)) {
      case (?b) {
        let arr = Buffer.toArray(b);
        for (cp in arr.vals()) {
          if (Principal.notEqual(cp, except)) { await sendWs(cp, msg) };
        };
      };
      case (null) {};
    };
  };

  // ===== Presence =====
  func pushParticipants(roomId : Text, toCp : ?Principal) : async () {
    let parts = switch (rooms.get(roomId)) {
      case (?r) r.participants;
      case (null) return;
    };
    let msg : Types.WsMessage = #Participants({ roomId; participants = parts });
    switch (toCp) {
      case (?cp) { await sendWs(cp, msg) };
      case (null) { await sendToRoom(roomId, msg) };
    };
  };

  func pushJoined(roomId : Text, who : Principal) : async () {
    await sendToRoom(roomId, #Joined({ roomId; who }));
  };

  func pushLeft(roomId : Text, who : Principal) : async () {
    await sendToRoom(roomId, #Left({ roomId; who }));
  };

  // ===== Signaling relay =====
  func sendRtcTo(roomId : Text, to : Principal, from : Principal, payload : Types.RtcPayload) : async () {
    switch (subsByRoom.get(roomId)) {
      case (?b) {
        let arr = Buffer.toArray(b);
        for (cp in arr.vals()) {
          if (Principal.equal(cp, to)) {
            await sendWs(cp, #RtcFrom({ roomId; from; payload }));
          };
        };
      };
      case (null) {};
    };
  };

  // ===== WS handlers =====
  func on_open(args : IcWebSocketCdk.OnOpenCallbackArgs) : async () {
    connected.add(args.client_principal);
  };
  // func on_open(args : IcWebSocketCdk.OnOpenCallbackArgs) : async () { /* optional: track */ };

  func on_message(args : IcWebSocketCdk.OnMessageCallbackArgs) : async () {
    let inbound : ?Types.WsMessage = from_candid (args.message);
    switch (inbound) {
      case (?msg) {
        switch (msg) {
          case (#Subscribe { roomId }) {
            addSub(args.client_principal, roomId);

            // 1) Ack cuma ke caller
            await sendWs(args.client_principal, #Subscribed({ roomId; who = args.client_principal }));

            // 2) Snapshot cepat ke semua subscriber room
            await pushParticipants(roomId, null);

            // 3) Beritahu peer lain (kecuali caller) bahwa caller sudah "ready"
            await sendToRoomExcept(
              roomId,
              args.client_principal,
              #Subscribed({ roomId; who = args.client_principal }),
            );
          };

          case (#Unsubscribe { roomId }) {
            removeSub(args.client_principal, roomId);
          };

          // === JOIN ROOM via WS (lebih cepat daripada candid) ===
          case (#RoomJoin { roomId }) {
            switch (RoomService.joinRoom(rooms, roomId, args.client_principal)) {
              case (#ok(_)) {
                await pushJoined(roomId, args.client_principal);
                await pushParticipants(roomId, null);

                // optional: bangunkan peer lain
                switch (subsByRoom.get(roomId)) {
                  case (?b) {
                    let arr = Buffer.toArray(b);
                    for (cp in arr.vals()) {
                      if (Principal.notEqual(cp, args.client_principal)) {
                        await sendWs(cp, #RtcHelloFrom({ roomId; from = args.client_principal }));
                      };
                    };
                  };
                  case (null) {};
                };
              };
              case (#err(e)) { await sendWs(args.client_principal, #Error(e)) };
            };
          };

          case (#RoomLeave { roomId }) {
            // <— NEW
            switch (RoomService.leaveRoom(rooms, roomId, args.client_principal)) {
              case (#ok(_)) {
                await pushLeft(roomId, args.client_principal);
                await pushParticipants(roomId, null);
              };
              case (#err(e)) { await sendWs(args.client_principal, #Error(e)) };
            };
          };

          // === Relay RTC ===
          case (#RtcSend { roomId; to; payload }) {
            await sendRtcTo(roomId, to, args.client_principal, payload);
          };

          // (opsional) Hello manual — tidak kita pakai dari FE
          case (#RtcHello { roomId }) {
            switch (subsByRoom.get(roomId)) {
              case (?b) {
                let arr = Buffer.toArray(b);
                for (cp in arr.vals()) {
                  if (Principal.notEqual(cp, args.client_principal)) {
                    await sendWs(cp, #RtcHelloFrom({ roomId; from = args.client_principal }));
                  };
                };
              };
              case (null) {};
            };
          };

          // outbound-only diabaikan
          case (#Participants _) {};
          case (#Joined _) {};
          case (#Left _) {};
          case (#Subscribed _) {};
          case (#RtcFrom _) {};
          case (#RtcHelloFrom _) {};
          case (#Ping _) {};
          case (#Pong _) {};
          case (#Error _) {};
        };
      };
      case (null) {
        await sendWs(args.client_principal, #Error("INVALID_MESSAGE"));
      };
    };
  };

  func on_close(args : IcWebSocketCdk.OnCloseCallbackArgs) : async () {
    // 1) Hapus semua subscription yang tersisa (sudah ada)
    switch (roomsByClient.get(args.client_principal)) {
      case (?rb) {
        let arr = Buffer.toArray(rb);
        for (rid in arr.vals()) { removeSub(args.client_principal, rid) };
      };
      case (null) {};
    };

    // 2) AUTO-LEAVE dari SEMUA room tempat user ini masih menjadi participant
    //    (scan map `rooms` lalu panggil RoomService.leaveRoom)
    for ((rid, r) in rooms.entries()) {
      var isMember = false;
      // r.participants : [Principal]
      for (p in r.participants.vals()) {
        if (Principal.equal(p, args.client_principal)) { isMember := true };
      };
      if (isMember) {
        switch (RoomService.leaveRoom(rooms, rid, args.client_principal)) {
          case (#ok(_)) {
            // broadcast supaya peer lain langsung tahu
            await pushLeft(rid, args.client_principal);
            await pushParticipants(rid, null);
          };
          case (#err(_)) { /* abaikan */ };
        };
      };
    };
  };

  // public shared query func getAllConnectedClients() : async [IcWebSocketCdk.ClientPrincipal] {
  //   Buffer.toArray<IcWebSocketCdk.ClientPrincipal>(connected_clients);
  // };

  // ===== Wire CDK =====
  // Polling gateway: 200ms
  let params = IcWebSocketCdkTypes.WsInitParams(null, ?200_000_000);
  let ws_state = IcWebSocketCdkState.IcWebSocketState(params);
  let handlers = IcWebSocketCdkTypes.WsHandlers(
    ?on_open,
    ?on_message,
    ?on_close,
  );
  let ws = IcWebSocketCdk.IcWebSocket(ws_state, params, handlers);

  public shared ({ caller }) func ws_open(args : IcWebSocketCdk.CanisterWsOpenArguments) : async IcWebSocketCdk.CanisterWsOpenResult {
    await ws.ws_open(caller, args);
  };
  public shared ({ caller }) func ws_close(args : IcWebSocketCdk.CanisterWsCloseArguments) : async IcWebSocketCdk.CanisterWsCloseResult {
    await ws.ws_close(caller, args);
  };
  public shared ({ caller }) func ws_message(args : IcWebSocketCdk.CanisterWsMessageArguments, msg : ?Types.WsMessage) : async IcWebSocketCdk.CanisterWsMessageResult {
    await ws.ws_message(caller, args, msg);
  };
  public shared query ({ caller }) func ws_get_messages(args : IcWebSocketCdk.CanisterWsGetMessagesArguments) : async IcWebSocketCdk.CanisterWsGetMessagesResult {
    ws.ws_get_messages(caller, args);
  };
};
