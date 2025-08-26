import Time "mo:base/Time";

module {
  public type UserStatus = {
    online : Bool;
    lastOnline : Time.Time;
    lastOffline : ?Time.Time;
  };
};