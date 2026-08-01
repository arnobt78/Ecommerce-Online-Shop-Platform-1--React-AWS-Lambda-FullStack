/**
 * Create Ticket Page
 *
 * Customer-facing page to create a new support ticket.
 * Uses reusable ShadCN UI components and React Query hooks.
 */

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTitle } from "../../hooks/useTitle";
import { useCreateTicket } from "../../hooks/useTickets";
import { useUserOrders } from "../../hooks/useUser";
import { Card, FormInput, FormTextarea, FormLabel, FormError, FormSelect, RippleButton } from "../../components/ui";
import type { TicketPriority, TicketCategory } from "../../types";

interface CreateTicketFormData {
  subject: string;
  message: string;
  priority: TicketPriority;
  category: TicketCategory;
  orderId: string;
}

type CreateTicketFormErrors = Partial<Record<"subject" | "message", string>>;

const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: "billing", label: "Billing" },
  { value: "technical", label: "Technical Issue" },
  { value: "refund", label: "Refund Request" },
  { value: "account", label: "Account" },
  { value: "other", label: "Other" },
];

export const CreateTicketPage = () => {
  useTitle("Create Support Ticket");
  const navigate = useNavigate();

  const [formData, setFormData] = useState<CreateTicketFormData>({ subject: "", message: "", priority: "medium", category: "other", orderId: "" });
  const [errors, setErrors] = useState<CreateTicketFormErrors>({});

  const createTicketMutation = useCreateTicket();
  const { data: orders = [] } = useUserOrders();

  const orderOptions = [
    { value: "", label: "Not related to a specific order" },
    ...orders.map((order) => ({ value: order.id, label: `${order.id.slice(0, 8)}... — $${order.amount_paid?.toFixed(2) ?? "0.00"}` })),
  ];

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as { name: keyof CreateTicketFormData; value: string };
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (name in errors && errors[name as keyof CreateTicketFormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validate = (): boolean => {
    const newErrors: CreateTicketFormErrors = {};

    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    } else if (formData.subject.trim().length < 5) {
      newErrors.subject = "Subject must be at least 5 characters";
    }

    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    } else if (formData.message.trim().length < 10) {
      newErrors.message = "Message must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    createTicketMutation.mutate(
      {
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        priority: formData.priority,
        category: formData.category,
        orderId: formData.orderId || undefined,
      },
      {
        onSuccess: (data) => {
          navigate(`/tickets/${data.id}`);
        },
      },
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="">
        <div className="mb-6">
          <h1 className="text-3xl font-medium text-gray-700 dark:text-white">Create Support Ticket</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Describe your issue and we'll get back to you as soon as possible.</p>
        </div>

        <Card className="p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <FormLabel htmlFor="subject" required>
                Subject
              </FormLabel>
              <FormInput
                id="subject"
                name="subject"
                type="text"
                value={formData.subject}
                onChange={handleChange}
                placeholder="Brief description of your issue"
                required
                disabled={createTicketMutation.isPending}
                className={errors.subject ? "border-red-500" : ""}
              />
              {errors.subject && <FormError message={errors.subject} />}
            </div>

            <div>
              <FormLabel htmlFor="message" required>
                Message
              </FormLabel>
              <FormTextarea
                id="message"
                name="message"
                value={formData.message}
                onChange={handleChange}
                placeholder="Please provide details about your issue..."
                rows={8}
                required
                disabled={createTicketMutation.isPending}
                className={errors.message ? "border-red-500" : ""}
              />
              {errors.message && <FormError message={errors.message} />}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor="category">Category</FormLabel>
                <FormSelect id="category" name="category" value={formData.category} onChange={handleChange} options={CATEGORY_OPTIONS} disabled={createTicketMutation.isPending} />
              </div>
              <div>
                <FormLabel htmlFor="priority">Priority</FormLabel>
                <FormSelect id="priority" name="priority" value={formData.priority} onChange={handleChange} options={PRIORITY_OPTIONS} disabled={createTicketMutation.isPending} />
              </div>
            </div>

            {orders.length > 0 && (
              <div>
                <FormLabel htmlFor="orderId">Related Order (optional)</FormLabel>
                <FormSelect id="orderId" name="orderId" value={formData.orderId} onChange={handleChange} options={orderOptions} disabled={createTicketMutation.isPending} />
              </div>
            )}

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => navigate("/tickets")}
                disabled={createTicketMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Cancel
              </button>
              <RippleButton
                type="submit"
                disabled={createTicketMutation.isPending}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
              </RippleButton>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};
