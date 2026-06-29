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
  const { queryKeyToInvalidate, successMessage, errorMessage, onSuccess: userOnSuccess, onError: userOnError, confirmModal, ...mutationOptions } = options;

  const mutation = useMutation({
    ...mutationOptions,
    onSuccess: (data, variables, context) => {
      notifications.show({
        color: 'green',
        icon: <IconCheck size={18} />,
        title: 'Éxito',
        message: successMessage ?? 'Operación completada',
      });
      if (queryKeyToInvalidate) {
        const keys = Array.isArray(queryKeyToInvalidate)
          ? queryKeyToInvalidate
          : [queryKeyToInvalidate];
        keys.forEach((key) => qc.invalidateQueries({ queryKey: [key] }));
      }
      userOnSuccess?.(data, variables, context);
    },
    onError: (error, variables, context) => {
      notifications.show({
        color: 'red',
        icon: <IconX size={18} />,
        title: 'Error',
        message: errorMessage ?? error.message ?? 'Algo salió mal',
      });
      userOnError?.(error, variables, context);
    },
  });

  const mutateWithConfirm = (variables: TVariables) => {
    if (confirmModal) {
      modals.openConfirmModal({
        title: confirmModal.title,
        children: confirmModal.message,
        labels: {
          confirm: confirmModal.labels?.confirm ?? 'Confirmar',
          cancel: confirmModal.labels?.cancel ?? 'Cancelar',
        },
        confirmProps: { color: confirmModal.confirmColor ?? 'red' },
        onConfirm: () => mutation.mutate(variables),
      });
    } else {
      mutation.mutate(variables);
    }
  };

  return { ...mutation, mutateWithConfirm };
}
