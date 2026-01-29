// Type declarations for friendship-related RPC functions
// These will be properly typed when database.types.ts is regenerated after migration

export type FriendshipRpcFunctions = {
  are_friends: {
    Args: { user_a: string; user_b: string };
    Returns: boolean;
  };
  create_friendship: {
    Args: { user_a: string; user_b: string };
    Returns: string; // UUID
  };
  delete_friendship: {
    Args: { user_a: string; user_b: string };
    Returns: boolean;
  };
  get_friend_ids: {
    Args: { user_id: string };
    Returns: { friend_id: string }[];
  };
};

// Helper type for RPC calls that aren't in the generated types yet
export type RpcCall<T extends keyof FriendshipRpcFunctions> = {
  data: FriendshipRpcFunctions[T]["Returns"] | null;
  error: Error | null;
};
