"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  coerceNutrition,
  formatFoodItemLine,
  formatFoodsSummary,
} from "@/lib/mealNutrition";

type MealLog = {
  id: number;
  rawInput: string;
  result: unknown;
  createdAt: string;
};

type RowDraft = {
  rawInput: string;
  foodsLine: string;
  kcal: string;
  p: string;
  f: string;
  c: string;
  createdAt: string;
};

const inputClass =
  "w-full min-w-[3.5rem] rounded-md border border-neutral-200 bg-white px-2 py-1.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400";

type Props = {
  logs: MealLog[];
  selected: Set<number>;
  editing: Set<number>;
  drafts: Record<number, RowDraft>;
  expandedFoodRows: Set<number>;
  expandedContentRows: Set<number>;
  dbError: string | null;
  onToggleSelect: (id: number) => void;
  onToggleFoodDetail: (id: number) => void;
  onToggleContent: (id: number) => void;
  onCancelRowEdit: (id: number) => void;
  onDraftChange: (id: number, patch: Partial<RowDraft>) => void;
};

export function MealLogCards({
  logs,
  selected,
  editing,
  drafts,
  expandedFoodRows,
  expandedContentRows,
  dbError,
  onToggleSelect,
  onToggleFoodDetail,
  onToggleContent,
  onCancelRowEdit,
  onDraftChange,
}: Props) {
  if (!logs.length) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white px-4 py-6 text-sm text-neutral-500 md:hidden">
        {dbError
          ? "上記の手順でDBを起動・マイグレーションすると、ここに記録が表示されます。"
          : "まだ記録がありません。食事を送信し、確認画面から記録してください。"}
      </div>
    );
  }

  return (
    <ul className="space-y-3 md:hidden">
      {logs.map((log) => {
        const n = coerceNutrition(log.result);
        const isEditing = editing.has(log.id);
        const draft = drafts[log.id];
        const hasFoods = n.foods.length > 0;
        const detailOpen = expandedFoodRows.has(log.id);
        const contentOpen = expandedContentRows.has(log.id) || isEditing;
        const contentText = isEditing && draft ? draft.rawInput : log.rawInput;
        const foodsText =
          isEditing && draft ? draft.foodsLine : formatFoodsSummary(n);

        return (
          <li
            key={log.id}
            className={cn(
              "rounded-lg border border-neutral-200 bg-white p-3 shadow-sm",
              isEditing && "border-amber-300 bg-amber-50/50"
            )}
          >
            {/* 上段: 日時・チェック・操作 */}
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-400"
                checked={selected.has(log.id)}
                onChange={() => onToggleSelect(log.id)}
                aria-label={`記録 ${log.id} を選択`}
              />
              <div className="min-w-0 flex-1">
                {isEditing && draft ? (
                  <input
                    type="datetime-local"
                    className={cn(inputClass, "text-sm")}
                    value={draft.createdAt}
                    onChange={(e) =>
                      onDraftChange(log.id, { createdAt: e.target.value })
                    }
                  />
                ) : (
                  <p className="text-sm font-medium text-neutral-900">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                )}
              </div>
              {isEditing ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  onClick={() => onCancelRowEdit(log.id)}
                >
                  取消
                </Button>
              ) : null}
            </div>

            {/* 中段: 内容（折りたたみ） */}
            <div className="mt-3">
              {isEditing && draft ? (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-neutral-600">
                    内容
                  </label>
                  <Textarea
                    rows={3}
                    className="text-sm"
                    value={draft.rawInput}
                    onChange={(e) =>
                      onDraftChange(log.id, { rawInput: e.target.value })
                    }
                  />
                  <label className="block text-xs font-medium text-neutral-600">
                    内訳（食品）
                  </label>
                  <Textarea
                    rows={2}
                    className="text-sm"
                    value={draft.foodsLine}
                    onChange={(e) =>
                      onDraftChange(log.id, { foodsLine: e.target.value })
                    }
                  />
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-2 text-left"
                    onClick={() => onToggleContent(log.id)}
                    aria-expanded={contentOpen}
                  >
                    <p
                      className={cn(
                        "text-sm text-neutral-800",
                        !contentOpen && "line-clamp-2"
                      )}
                    >
                      {contentText}
                    </p>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {contentOpen ? "閉じる" : "詳細"}
                    </span>
                  </button>
                  {contentOpen && foodsText ? (
                    <p className="mt-2 text-xs leading-relaxed text-neutral-600">
                      {foodsText}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {/* 下段: kcal / P / F / C */}
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-neutral-100 pt-3">
              {(
                [
                  ["kcal", "kcal", draft?.kcal, n.total.kcal, ""],
                  ["P", "p", draft?.p, n.total.p, "g"],
                  ["F", "f", draft?.f, n.total.f, "g"],
                  ["C", "c", draft?.c, n.total.c, "g"],
                ] as const
              ).map(([label, key, draftVal, viewVal, unit]) => (
                <div key={key} className="min-w-0 text-center">
                  <p className="text-[11px] font-medium text-neutral-500">{label}</p>
                  {isEditing && draft ? (
                    <input
                      type="number"
                      inputMode="decimal"
                      className={cn(inputClass, "mt-1 px-1 text-center text-sm")}
                      value={draftVal ?? ""}
                      onChange={(e) =>
                        onDraftChange(log.id, { [key]: e.target.value })
                      }
                      aria-label={label}
                    />
                  ) : (
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-neutral-900">
                      {viewVal}
                      {unit ? (
                        <span className="text-[10px] font-normal text-neutral-500">
                          {unit}
                        </span>
                      ) : null}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* 内訳アコーディオン */}
            <div className="mt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-between px-2 text-xs text-neutral-600"
                disabled={!hasFoods}
                aria-expanded={detailOpen}
                onClick={() => onToggleFoodDetail(log.id)}
              >
                <span>食品ごとの内訳</span>
                <span>{detailOpen ? "▼" : "▶"}</span>
              </Button>
              {detailOpen && hasFoods ? (
                <ul className="mt-1 space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
                  {n.foods.map((food, idx) => (
                    <li
                      key={`${log.id}-card-f-${idx}`}
                      className="font-mono text-[12px] leading-relaxed text-neutral-800"
                    >
                      {formatFoodItemLine(food)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
