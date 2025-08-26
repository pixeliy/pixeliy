import Types "../types/Types";
import Principal "mo:base/Principal";
import Text "mo:base/Text";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Nat "mo:base/Nat";
import Array "mo:base/Array";

module {
  func validOutfitLength(slots : [Text]) : Bool {
    return Array.size(slots) == Array.size(Types.OUTFIT_SLOT_ORDER);
  };

  func normalizeSlots(slots : [Text]) : [Text] {
    if (validOutfitLength(slots)) { slots } else { Types.OUTFIT_DEFAULT };
  };

  public func authenticateUser(users : Types.Users, userId : Principal, username : Text) : Result.Result<Types.User, Text> {
    if (Text.size(username) < 3) {
      return #err("Username must be at least 3 characters long");
    };

    if (Principal.isAnonymous(userId)) { return #err("Invalid principal") };

    for ((id, user) in users.entries()) {
      if (Text.equal(user.username, username)) {
        if (id != userId) {
          return #err("USERNAME_TAKEN: The username '" # username # "' is already in use.");
        };
      };
    };

    switch (users.get(userId)) {
      case (?existingUser) { #ok(existingUser) };
      case (null) {
        let newUser : Types.User = {
          id = userId;
          username = username;
          name = null;
          createdAt = Time.now();
          profilePicture = null;
          outfitSlots = ?Types.OUTFIT_DEFAULT;
        };

        users.put(userId, newUser);

        #ok(newUser);
      };
    };
  };

  public func updateUserProfile(users : Types.Users, userId : Principal, updateData : Types.UserUpdateData) : Result.Result<Types.User, Text> {
    if (Principal.isAnonymous(userId)) {
      return #err("Anonymous principals are not allowed");
    };

    switch (users.get(userId)) {
      case (null) { return #err("User not found!") };

      case (?user) {
        let username = switch (updateData.username) {
          case (null) { user.username };
          case (?newUsername) {
            if (Text.size(newUsername) < 3) {
              return #err("Username must be at least 3 characters long");
            };

            if (newUsername != user.username) {
              for ((id, existingUser) in users.entries()) {
                if (id != userId and Text.equal(existingUser.username, newUsername)) {
                  return #err("USERNAME_TAKEN: The username '" # newUsername # "'is already in use.");
                };
              };
            };
            newUsername;
          };
        };

        let name = switch (updateData.name) {
          case (null) { user.name };
          case (?newName) { ?newName };
        };

        let profilePicture = switch (updateData.profilePicture) {
          case (null) { user.profilePicture };
          case (?newProfilePicture) { ?newProfilePicture };
        };

        let outfitSlots = switch (updateData.outfitSlots) {
          case (null) { user.outfitSlots };
          case (?newSlots) {
            if (not validOutfitLength(newSlots)) {
              return #err("Invalid outfit length. Expecting " # Nat.toText(Array.size(Types.OUTFIT_SLOT_ORDER)) # " slots.");
            };
            ?normalizeSlots(newSlots);
          };
        };

        let updatedUser : Types.User = {
          id = user.id;
          username = username;
          name = name;
          createdAt = user.createdAt;
          profilePicture = profilePicture;
          outfitSlots = switch (outfitSlots) {
            case (?s) ?s;
            case (null) user.outfitSlots;
          };
        };

        users.put(userId, updatedUser);
        #ok(updatedUser);
      };
    };
  };

  public func setUserOutfit(users : Types.Users, userId : Principal, slots : [Text]) : Result.Result<Types.User, Text> {
    if (Principal.isAnonymous(userId)) return #err("Anonymous principals are not allowed");

    if (not validOutfitLength(slots)) {
      return #err("Invalid outfit length. Expecting " # Nat.toText(Array.size(Types.OUTFIT_SLOT_ORDER)) # " slots.");
    };

    switch (users.get(userId)) {
      case (null) { return #err("User not found!") };
      case (?user) {
        let updated : Types.User = {
          id = user.id;
          username = user.username;
          name = user.name;
          createdAt = user.createdAt;
          profilePicture = user.profilePicture;
          outfitSlots = ?normalizeSlots(slots);
        };
        users.put(userId, updated);
        #ok(updated);
      };
    };
  };

  public func getUserByUsername(users : Types.Users, username : Text) : ?Types.User {
    for ((principal, user) in users.entries()) {
      if (user.username == username) {
        return ?user;
      };
    };
    return null;
  };

  public func getUserOutfit(users : Types.Users, userId : Principal) : [Text] {
    switch (users.get(userId)) {
      case (?u) {
        switch (u.outfitSlots) { case (?s) s; case (null) Types.OUTFIT_DEFAULT };
      };
      case (null) { Types.OUTFIT_DEFAULT };
    };
  };
};
