export interface MessagePermissions {
  isSender: boolean;
  canEdit: boolean;
  canDeleteForMe: boolean;
  canDeleteForEveryone: boolean;
  canPin: boolean;
  canForward: boolean;
  canReply: boolean;
  canReact: boolean;
  canCopy?: boolean;
}
