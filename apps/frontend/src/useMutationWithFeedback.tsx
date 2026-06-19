import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useMutation, useQueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { IconCheck, IconX } from '@tabler/icons-react';

interface UseMutationWithFeedbackOptions<TData, TVariables>
  extends Omit<UseMutationOptions<TData, Error, TVariables>, 'onSuccess' | 'onError'> {
  queryKeyToInvalidate?: string | string[];
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void;
  onError?: (error: Error, variables: TVariables, context: unknown) => void;
  confirmModal?: {
    title: string;
    message: string;
    labels?: { confirm?: string; cancel?: string };
    confirmColor?: string;
  };
}

export function useMutationWithFeedback<TData, TVariables>(
  options: UseMutationWithFeedbackOptions<TData, TVariables>,
) {
  const qc = useQueryClient();

  const mutation = useMutation({
    ...options,
    onSuccess: (data, variables, context) => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: options.successMessage ?? 'Operación completada',
      });
      if (options.queryKeyToInvalidate) {
        const keys = Array.isArray(options.queryKeyToInvalidate)
          ? options.queryKeyToInvalidate
          : [options.queryKeyToInvalidate];
        keys.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      }
      options.onSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      notifications.show({
        color: 'red',
        icon: <IconX size={18} />,
        title: 'Error',
        message: options.errorMessage ?? error.message ?? 'Algo salió mal',
      });
      options.onError?.(error, variables, context);
    },
  });

  const mutateWithConfirm = (variables: TVariables) => {
    if (options.confirmModal) {
      modals.openConfirmModal({
        title: options.confirmModal.title,
        children: options.confirmModal.message,
        labels: {
          confirm: options.confirmModal.labels?.confirm ?? 'Confirmar',
          cancel: options.confirmModal.labels?.cancel ?? 'Cancelar',
        },
        confirmProps: { color: options.confirmModal.confirmColor ?? 'red' },
        onConfirm: () => mutation.mutate(variables),
      });
    } else {
      mutation.mutate(variables);
    }
  };

  return { ...mutation, mutateWithConfirm };
}
