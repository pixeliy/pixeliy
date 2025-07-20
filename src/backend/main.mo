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

actor {
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
        RoomService.joinRoom(rooms, roomId, msg.caller);
    };

    public query func getRoom(roomId : Text) : async ?Types.Room {
        RoomService.getRoom(rooms, roomId);
    };

    public shared (msg) func leaveRoom(roomId : Text) : async Result.Result<Types.Room, Text> {
        RoomService.leaveRoom(rooms, roomId, msg.caller);
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
    // public shared (_msg) func resetAllSignals() : async () {
    //     signals := HashMap.HashMap(0, Text.equal, Text.hash);
    // };

};
