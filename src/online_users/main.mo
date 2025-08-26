import Timer "mo:base/Timer";
import Time "mo:base/Time";
import Principal "mo:base/Principal";
import TrieMap "mo:base/TrieMap";
import Iter "mo:base/Iter";
import Types "types/Types";

persistent actor OnlineUsers {
  private var userEntries : [(Principal, Types.UserStatus)] = [];

  transient let users = TrieMap.TrieMap<Principal, Types.UserStatus>(Principal.equal, Principal.hash);

  system func preupgrade() {
    userEntries := Iter.toArray(users.entries());
  };

  system func postupgrade() {
    for ((p, s) in userEntries.vals()) {
      users.put(p, s);
    };
    userEntries := [];
  };

  // Mark the caller as online and update lastOnline timestamp
  public func registerOnline(user : Principal) : async () {
    if (Principal.isAnonymous(user)) {
      return;
    };

    let now = Time.now();
    let status = switch (users.get(user)) {
      case (?s) {
        { online = true; lastOnline = now; lastOffline = s.lastOffline };
      };
      case null { { online = true; lastOnline = now; lastOffline = null } };
    };
    users.put(user, status);
  };

  // Mark the caller as offline and update lastOffline timestamp
  public func unregisterOnline(user : Principal) : async () {
    if (Principal.isAnonymous(user)) {
      return;
    };

    let now = Time.now();
    let status = switch (users.get(user)) {
      case (?s) {
        { online = false; lastOnline = s.lastOnline; lastOffline = ?now };
      };
      case null { { online = false; lastOnline = 0; lastOffline = ?now } };
    };
    users.put(user, status);
  };

  // Get all users and their status (online/offline, lastOnline, lastOffline)
  public query func status() : async [(Principal, Types.UserStatus)] {
    Iter.toArray(users.entries());
  };

  // Check if a specific user is online
  public query func isUserOnline(user : Principal) : async Bool {
    switch (users.get(user)) {
      case (?s) { s.online };
      case null { false };
    };
  };

  // Recurring timer for auto-logout: set user offline if lastOnline > 1 minute ago
  ignore Timer.recurringTimer<system>(
    #seconds 15,
    func() : async () {
      let now = Time.now();
      for ((p, s) in users.entries()) {
        // If user is online and inactive for more than 1 minute, set offline
        if (s.online and (now - s.lastOnline > 60_000_000_000)) {
          users.put(p, { online = false; lastOnline = s.lastOnline; lastOffline = ?now });
        };
      };
    },
  );
};
