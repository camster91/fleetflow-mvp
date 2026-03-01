/**
 * FleetFlow UI Component Library
 * 
 * A comprehensive set of reusable UI components for the FleetFlow
 * fleet management application.
 * 
 * @example
 * ```tsx
 * import { Button, Card, Badge, Modal } from '@/components/ui';
 * 
 * export default function MyComponent() {
 *   return (
 *     <Card title="Vehicle Status">
 *       <Badge variant="success">Active</Badge>
 *       <Button onClick={() => setIsOpen(true)}>View Details</Button>
 *     </Card>
 *   );
 * }
 * ```
 */

// Button Component
export { Button, type ButtonProps } from './Button';

// Card Component
export { 
  Card, 
  CardHeader, 
  CardContent, 
  CardFooter,
  StatCard,
  type CardProps,
  type CardHeaderProps,
  type CardContentProps,
  type CardFooterProps,
  type StatCardProps,
} from './Card';

// Input Component
export { 
  Input, 
  TextArea,
  Textarea,
  Select,
  type InputProps,
  type TextAreaProps,
  type SelectProps,
} from './Input';

// Badge Component
export { 
  Badge, 
  StatusBadge,
  type BadgeProps,
  type StatusBadgeProps,
} from './Badge';

// Modal Component
export { 
  Modal, 
  ModalFooter,
  ConfirmModal,
  type ModalProps,
  type ModalFooterProps,
  type ConfirmModalProps,
} from './Modal';

// Alert Component
export { 
  Alert, 
  AlertGroup,
  InlineAlert,
  type AlertProps,
  type AlertGroupProps,
  type InlineAlertProps,
} from './Alert';

// Avatar Component
export { 
  Avatar, 
  AvatarGroup,
  type AvatarProps,
  type AvatarGroupProps,
} from './Avatar';

// Skeleton Component
export { 
  Skeleton, 
  SkeletonCard,
  SkeletonTable,
  SkeletonAvatar,
  SkeletonText,
  type SkeletonProps,
  type SkeletonCardProps,
  type SkeletonTableProps,
  type SkeletonAvatarProps,
  type SkeletonTextProps,
  type SkeletonVariant,
  type SkeletonAnimation,
} from './Skeleton';

// Table Component
export { 
  Table, 
  useTableSort,
  usePagination,
  type TableProps,
  type Column,
  type PaginationInfo,
  type SortDirection,
} from './Table';

// Toast Component
export { 
  Toast,
  ToastContainer,
  ToastProvider,
  useToast,
  usePromiseToast,
  type ToastProps,
  type ToastContainerProps,
  type ToastProviderProps,
  type ToastData,
  type ToastType,
  type ToastPosition,
} from './Toast';
