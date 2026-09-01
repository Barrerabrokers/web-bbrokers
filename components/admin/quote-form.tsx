"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  FileText,
  Loader2,
  Mail,
  MessageCircle,
  Pencil,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { openMailShare } from "@/lib/mail-share";
import {
  ImageUploader,
  type ImageItem,
  withStableImageItemIds,
} from "@/components/admin/image-uploader";

type QuoteDevelopment = {
  id: string;
  name: string;
  slug: string;
  location: string;
  address: string;
  currency: string;
};

type QuoteFormProps = {
  developments: QuoteDevelopment[];
};

type QuoteFormData = {
  developmentId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  unitNumber: string;
  floor: string;
  bedrooms: string;
  bathrooms: string;
  area: string;
  balconyArea: string;
  totalArea: string;
  downPayment: string;
  installmentCount: string;
  installmentValue: string;
  price: string;
  expenses: string;
  currency: string;
  orientation: string;
  status: "disponible" | "reservada" | "vendida" | "consultar";
  description: string;
  features: string;
  comments: string;
};

type QuotePayload = {
  developmentId: string;
  developmentName?: string;
  developmentSlug?: string;
  address?: string;
  location?: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  unitNumber: string;
  floor?: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  balconyArea?: number;
  totalArea?: number;
  downPayment?: number;
  installmentCount?: number;
  installmentValue?: number;
  price: number;
  expenses?: number;
  currency: string;
  orientation?: string;
  status: QuoteFormData["status"];
  description?: string;
  features: string[];
  comments?: string;
  imageUrls?: string[];
  pdfUrl?: string;
};

type SavedQuote = {
  id: string;
  developmentId: string;
  developmentName: string;
  developmentSlug: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  unitNumber: string;
  payload: QuotePayload;
  canViewClient?: boolean;
  canManage?: boolean;
  updatedAt: string;
};

type InlinePdfImage = {
  data: string;
  width: number;
  height: number;
};

const ORIENTATIONS = [
  "Frente",
  "Contrafrente",
  "Lateral",
  "Norte",
  "Sur",
  "Este",
  "Oeste",
];
const QUOTE_MAX_IMAGES = 2;

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toFormNumber(value: number | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

function featuresToFormText(features: unknown) {
  if (Array.isArray(features)) {
    return features
      .map((feature) => String(feature || "").trim())
      .filter(Boolean)
      .join("\n");
  }

  return typeof features === "string" ? features : "";
}

function isLikelyJpegUrl(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith(".jpg") || pathname.endsWith(".jpeg");
  } catch {
    return /\.(jpe?g)(\?|#|$)/i.test(url);
  }
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo preparar la imagen para PDF"));
    image.src = src;
  });
}

async function imageSourceToJpegFile(
  src: string,
  fileName: string,
  options: { maxSide?: number; quality?: number } = {}
): Promise<File> {
  const image = await loadImageElement(src);
  const maxSide = options.maxSide || 1200;
  const ratio = Math.min(maxSide / image.naturalWidth, maxSide / image.naturalHeight, 1);
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("No se pudo preparar la imagen para PDF");

  context.fillStyle = "#f4eadc";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", options.quality ?? 0.82)
  );
  if (!blob) throw new Error("No se pudo preparar la imagen para PDF");

  return new File([blob], fileName.replace(/\.[^.]+$/, "") + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

async function fileToPdfJpeg(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await imageSourceToJpegFile(objectUrl, file.name || "cotizacion.jpg");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToInlinePdfImage(file: File): Promise<InlinePdfImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(objectUrl);
    const dataUrl = await readFileAsDataUrl(file);
    return {
      data: dataUrl.split(",")[1] || "",
      width: image.naturalWidth,
      height: image.naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function existingUrlToPdfJpegUrl(url: string) {
  if (isLikelyJpegUrl(url)) return url;
  try {
    const file = await imageSourceToJpegFile(url, "cotizacion.jpg");
    return await uploadFile(file, "quotes");
  } catch {
    return url;
  }
}

async function uploadFile(file: File, folder = "quotes") {
  const formData = new FormData();
  formData.append("folder", folder);
  formData.append("files", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  const data = (await response.json()) as { urls?: string[]; error?: string };
  if (!response.ok || !data.urls?.[0]) {
    throw new Error(data.error || "No se pudo subir el archivo");
  }
  return data.urls[0];
}

export function QuoteForm({ developments }: QuoteFormProps) {
  const firstDevelopment = developments[0];
  const [items, setItems] = useState<ImageItem[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState("");
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>([]);
  const [currentQuoteId, setCurrentQuoteId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [localPdfUrl, setLocalPdfUrl] = useState("");
  const [sharedPdfUrl, setSharedPdfUrl] = useState("");
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isPdfCurrent, setIsPdfCurrent] = useState(false);
  const activeQuoteRef = useRef<SavedQuote | null>(null);
  const pendingImageUploadRef = useRef<Promise<void> | null>(null);
  const itemsRef = useRef<ImageItem[]>([]);
  const isPdfCurrentRef = useRef(false);

  const [formData, setFormData] = useState<QuoteFormData>({
    developmentId: firstDevelopment?.id || "",
    clientName: "",
    clientPhone: "",
    clientEmail: "",
    unitNumber: "",
    floor: "",
    bedrooms: "1",
    bathrooms: "1",
    area: "",
    balconyArea: "",
    totalArea: "",
    downPayment: "",
    installmentCount: "",
    installmentValue: "",
    price: "",
    expenses: "",
    currency: firstDevelopment?.currency || "USD",
    orientation: "",
    status: "disponible",
    description: "",
    features: "",
    comments: "",
  });

  const selectedDevelopment = useMemo(
    () => developments.find((development) => development.id === formData.developmentId),
    [developments, formData.developmentId]
  );
  const currentSavedQuote = useMemo(
    () => savedQuotes.find((quote) => quote.id === currentQuoteId),
    [currentQuoteId, savedQuotes]
  );

  const refreshQuotes = async () => {
    const response = await fetch("/api/quotes", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { quotes?: SavedQuote[] };
    const nextQuotes = data.quotes || [];
    const activeId = activeQuoteRef.current?.id;
    if (activeId) {
      const freshActiveQuote = nextQuotes.find((quote) => quote.id === activeId);
      if (freshActiveQuote) activeQuoteRef.current = freshActiveQuote;
    }
    setSavedQuotes(nextQuotes);
  };

  useEffect(() => {
    refreshQuotes().catch(() => undefined);
  }, []);

  const markQuoteDirty = () => {
    isPdfCurrentRef.current = false;
    setIsPdfCurrent(false);
    setSharedPdfUrl("");
    setLocalPdfUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  };

  const markQuotePdfCurrent = (pdfUrl: string) => {
    isPdfCurrentRef.current = true;
    setIsPdfCurrent(true);
    setSharedPdfUrl(pdfUrl);
  };

  const update = (field: keyof QuoteFormData) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setFormData((current) => ({ ...current, [field]: value }));
    markQuoteDirty();
    setNotice("");
  };

  const handleDevelopmentChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const development = developments.find((candidate) => candidate.id === event.target.value);
    setFormData((current) => ({
      ...current,
      developmentId: event.target.value,
      currency: development?.currency || current.currency,
    }));
    markQuoteDirty();
    setNotice("");
  };

  const handleImagesChange = (nextItems: ImageItem[], nextPrimary: number) => {
    const stableItems = withStableImageItemIds(nextItems).slice(0, QUOTE_MAX_IMAGES);
    itemsRef.current = stableItems;
    setItems(stableItems);
    setPrimaryIndex(Math.min(nextPrimary, Math.max(stableItems.length - 1, 0)));
    markQuoteDirty();
    setNotice("");

    const hasNewImages = stableItems.some((item) => item.kind === "new");
    if (!hasNewImages) return;

    const uploadPromise = (async () => {
      setIsUploadingImages(true);
      setError("");
      try {
        const uploadedItems: ImageItem[] = [];
        for (const item of stableItems) {
          if (item.kind === "existing") {
            uploadedItems.push(item);
            continue;
          }

          const jpegFile = await fileToPdfJpeg(item.file);
          const url = await uploadFile(jpegFile, "quotes");
          URL.revokeObjectURL(item.preview);
          uploadedItems.push({
            kind: "existing",
            url,
            id: `existing-${url}`,
          });
        }

        itemsRef.current = uploadedItems;
        setItems(uploadedItems);
        setPrimaryIndex((current) =>
          Math.min(current, Math.max(uploadedItems.length - 1, 0))
        );
        setNotice("Imágenes guardadas en la cotización. Ahora podés guardar o generar el PDF.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron guardar las imágenes");
      } finally {
        setIsUploadingImages(false);
        pendingImageUploadRef.current = null;
      }
    })();

    pendingImageUploadRef.current = uploadPromise;
  };

  const buildImageUrls = async () => {
    const activePayload = activeQuoteRef.current?.payload;
    const currentItems = itemsRef.current.length > 0 ? itemsRef.current : items;
    if (currentItems.length === 0 && activePayload?.imageUrls?.length) {
      return safeImageUrls(activePayload.imageUrls);
    }

    const urls: string[] = [];
    for (const item of currentItems.slice(0, QUOTE_MAX_IMAGES)) {
      if (item.kind === "existing") urls.push(await existingUrlToPdfJpegUrl(item.url));
      else urls.push(await uploadFile(await fileToPdfJpeg(item.file), "quotes"));
    }
    return urls;
  };

  const buildQuoteImagesForPdf = async () => {
    const activePayload = activeQuoteRef.current?.payload;
    const currentItems = itemsRef.current.length > 0 ? itemsRef.current : items;
    if (currentItems.length === 0 && activePayload?.imageUrls?.length) {
      return {
        imageUrls: safeImageUrls(activePayload.imageUrls),
        inlineImages: [],
      };
    }

    const imageUrls: string[] = [];
    const inlineImages: InlinePdfImage[] = [];

    for (const item of currentItems.slice(0, QUOTE_MAX_IMAGES)) {
      if (item.kind === "existing") {
        try {
          const jpegFile = await imageSourceToJpegFile(item.url, "cotizacion.jpg", {
            maxSide: 1000,
            quality: 0.76,
          });
          imageUrls.push(await uploadFile(jpegFile, "quotes"));
          inlineImages.push(await fileToInlinePdfImage(jpegFile));
        } catch {
          imageUrls.push(await existingUrlToPdfJpegUrl(item.url));
        }
      } else {
        const jpegFile = await fileToPdfJpeg(item.file);
        imageUrls.push(await uploadFile(jpegFile, "quotes"));
        inlineImages.push(await fileToInlinePdfImage(jpegFile));
      }
    }

    return { imageUrls, inlineImages };
  };

  const safeImageUrls = (imageUrls: string[] | undefined) =>
    Array.isArray(imageUrls) ? imageUrls.filter(Boolean).slice(0, QUOTE_MAX_IMAGES) : [];

  const setPersistedImages = (imageUrls: string[] | undefined) => {
    const nextItems = safeImageUrls(imageUrls).map((url) => ({
      kind: "existing" as const,
      url,
      id: `existing-${url}`,
    }));
    itemsRef.current = nextItems;
    setItems(nextItems);
    setPrimaryIndex(0);
  };

  const buildPayload = (imageUrls: string[], pdfUrl?: string): QuotePayload => {
    const existingPayload = activeQuoteRef.current?.payload || currentSavedQuote?.payload;
    const parsedFeatures = formData.features
      .split("\n")
      .map((feature) => feature.trim())
      .filter(Boolean);
    const preservedImages =
      imageUrls.length > 0 ? imageUrls : safeImageUrls(existingPayload?.imageUrls);

    return {
      developmentId: formData.developmentId,
      developmentName: selectedDevelopment?.name,
      developmentSlug: selectedDevelopment?.slug,
      address: selectedDevelopment?.address,
      location: selectedDevelopment?.location,
      clientName: formData.clientName.trim() || undefined,
      clientPhone: formData.clientPhone.trim() || undefined,
      clientEmail: formData.clientEmail.trim() || undefined,
      unitNumber: formData.unitNumber.trim(),
      floor: formData.floor.trim() || undefined,
      bedrooms: Number(formData.bedrooms || 0),
      bathrooms: Number(formData.bathrooms || 0),
      area: Number(formData.area),
      balconyArea: toNumber(formData.balconyArea),
      totalArea: toNumber(formData.totalArea),
      downPayment: toNumber(formData.downPayment),
      installmentCount: formData.installmentCount ? Number(formData.installmentCount) : undefined,
      installmentValue: toNumber(formData.installmentValue),
      price: Number(formData.price),
      expenses: toNumber(formData.expenses),
      currency: formData.currency,
      orientation: formData.orientation || undefined,
      status: formData.status,
      description: formData.description.trim() || undefined,
      features: parsedFeatures,
      comments: formData.comments.trim() || undefined,
      imageUrls: preservedImages,
      pdfUrl: pdfUrl || (isPdfCurrentRef.current ? existingPayload?.pdfUrl : undefined),
    };
  };

  const validateQuote = () => {
    if (!selectedDevelopment) throw new Error("Seleccioná un desarrollo");
    if (!formData.unitNumber.trim()) throw new Error("Ingresá la unidad");
    if (!formData.area || !toNumber(formData.area)) throw new Error("Ingresá la superficie cubierta");
    if (!formData.price || !toNumber(formData.price)) throw new Error("Ingresá el precio final");
  };

  const saveQuote = async (pdfUrl?: string, knownImageUrls?: string[], silent = false) => {
    setError("");
    setNotice("");
    setIsSaving(true);

    try {
      if (pendingImageUploadRef.current) await pendingImageUploadRef.current;
      validateQuote();
      if (!selectedDevelopment) throw new Error("Seleccioná un desarrollo");
      const imageUrls = knownImageUrls || (await buildImageUrls());
      const payload = buildPayload(imageUrls, pdfUrl || (isPdfCurrentRef.current ? sharedPdfUrl : undefined));

      const response = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: currentQuoteId || undefined,
          developmentId: selectedDevelopment.id,
          developmentName: selectedDevelopment.name,
          developmentSlug: selectedDevelopment.slug,
          clientName: payload.clientName || "",
          clientPhone: payload.clientPhone || "",
          clientEmail: payload.clientEmail || "",
          unitNumber: formData.unitNumber.trim(),
          payload,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        quote?: SavedQuote;
        error?: string;
        details?: unknown;
      } | null;
      if (!response.ok || !data?.quote) {
        const details = data?.details ? ` ${JSON.stringify(data.details)}` : "";
        throw new Error(`${data?.error || "No se pudo guardar la cotización"}${details}`);
      }

      const persistedQuote: SavedQuote = {
        ...data.quote,
        clientName: payload.clientName || data.quote.clientName || "",
        clientPhone: payload.clientPhone || data.quote.clientPhone || "",
        clientEmail: payload.clientEmail || data.quote.clientEmail || "",
        unitNumber: payload.unitNumber || data.quote.unitNumber,
        payload: {
          ...payload,
          ...data.quote.payload,
          imageUrls: data.quote.payload?.imageUrls?.length
            ? data.quote.payload.imageUrls
            : payload.imageUrls,
          pdfUrl: data.quote.payload?.pdfUrl || payload.pdfUrl,
        },
      };

      setCurrentQuoteId(persistedQuote.id);
      activeQuoteRef.current = persistedQuote;
      setPersistedImages(persistedQuote.payload?.imageUrls);
      if (persistedQuote.payload.pdfUrl) {
        markQuotePdfCurrent(persistedQuote.payload.pdfUrl);
      } else {
        markQuoteDirty();
      }
      setSavedQuotes((current) => {
        const withoutSavedQuote = current.filter((quote) => quote.id !== persistedQuote.id);
        return [persistedQuote, ...withoutSavedQuote];
      });
      await refreshQuotes();
      if (!silent) {
        setNotice(
          currentQuoteId
            ? "Cambios guardados. Se actualizaron los datos del cliente y de la unidad."
            : "Cotización guardada. Ya podés reutilizarla y editar todos sus datos cuando quieras."
        );
      }
      return persistedQuote;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveQuote = async () => {
    try {
      await saveQuote();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la cotización");
    }
  };

  const loadQuote = (quote: SavedQuote, mode: "edit" | "duplicate" = "edit") => {
    const payload = quote.payload || ({} as QuotePayload);
    const isDuplicate = mode === "duplicate";
    activeQuoteRef.current = quote;
    setCurrentQuoteId(isDuplicate ? "" : quote.id);
    setFormData({
      developmentId: payload.developmentId || quote.developmentId,
      clientName: quote.clientName || payload.clientName || "",
      clientPhone: quote.clientPhone || payload.clientPhone || "",
      clientEmail: quote.clientEmail || payload.clientEmail || "",
      unitNumber: payload.unitNumber || quote.unitNumber,
      floor: payload.floor || "",
      bedrooms: toFormNumber(payload.bedrooms) || "1",
      bathrooms: toFormNumber(payload.bathrooms) || "1",
      area: toFormNumber(payload.area),
      balconyArea: toFormNumber(payload.balconyArea),
      totalArea: toFormNumber(payload.totalArea),
      downPayment: toFormNumber(payload.downPayment),
      installmentCount: toFormNumber(payload.installmentCount),
      installmentValue: toFormNumber(payload.installmentValue),
      price: toFormNumber(payload.price),
      expenses: toFormNumber(payload.expenses),
      currency: payload.currency || "USD",
      orientation: payload.orientation || "",
      status: payload.status || "disponible",
      description: payload.description || "",
      features: featuresToFormText(payload.features),
      comments: payload.comments || "",
    });
    setPersistedImages(payload.imageUrls);
    if (!isDuplicate && payload.pdfUrl) {
      markQuotePdfCurrent(payload.pdfUrl);
    } else {
      markQuoteDirty();
    }
    setLocalPdfUrl("");
    setError("");
    setNotice(
      isDuplicate
        ? "Cotización duplicada con los datos originales precargados. Modificá lo que necesites y guardala como nueva."
        : "Cotización cargada con los datos originales. Podés modificar cliente, unidad, financiación, comentarios e imágenes."
    );
  };

  const duplicateQuote = (quote: SavedQuote) => {
    loadQuote(quote, "duplicate");
  };

  const deleteSavedQuote = async (quote: SavedQuote) => {
    const confirmed = window.confirm(
      `¿Eliminar la cotización de ${quote.developmentName} · Unidad ${quote.unitNumber}?`
    );
    if (!confirmed) return;

    setError("");
    setNotice("");
    setDeletingQuoteId(quote.id);

    try {
      const response = await fetch(`/api/quotes?id=${encodeURIComponent(quote.id)}`, {
        method: "DELETE",
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error || "No se pudo eliminar la cotización");
      }

      if (activeQuoteRef.current?.id === quote.id) activeQuoteRef.current = null;
      if (currentQuoteId === quote.id) resetQuote();
      await refreshQuotes();
      setNotice("Cotización eliminada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la cotización");
    } finally {
      setDeletingQuoteId("");
    }
  };

  const resetQuote = () => {
    activeQuoteRef.current = null;
    setCurrentQuoteId("");
    pendingImageUploadRef.current = null;
    itemsRef.current = [];
    setIsUploadingImages(false);
    setItems([]);
    setPrimaryIndex(0);
    setLocalPdfUrl("");
    setSharedPdfUrl("");
    isPdfCurrentRef.current = false;
    setIsPdfCurrent(false);
    setError("");
    setNotice("");
    setFormData({
      developmentId: firstDevelopment?.id || "",
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      unitNumber: "",
      floor: "",
      bedrooms: "1",
      bathrooms: "1",
      area: "",
      balconyArea: "",
      totalArea: "",
      downPayment: "",
      installmentCount: "",
      installmentValue: "",
      price: "",
      expenses: "",
      currency: firstDevelopment?.currency || "USD",
      orientation: "",
      status: "disponible",
      description: "",
      features: "",
      comments: "",
    });
  };

  const generatePdf = async () => {
    setError("");
    setIsGenerating(true);
    setSharedPdfUrl("");

    try {
      if (pendingImageUploadRef.current) await pendingImageUploadRef.current;
      validateQuote();
      if (!selectedDevelopment) throw new Error("Seleccioná un desarrollo");

      const { imageUrls, inlineImages } = await buildQuoteImagesForPdf();
      const payload = {
        developmentName: selectedDevelopment.name,
        developmentSlug: selectedDevelopment.slug,
        address: selectedDevelopment.address,
        location: selectedDevelopment.location,
        clientName: formData.clientName.trim() || undefined,
        clientPhone: formData.clientPhone.trim() || undefined,
        clientEmail: formData.clientEmail.trim() || undefined,
        ...buildPayload(imageUrls),
        imageUrls,
        inlineImages,
      };

      const response = await fetch("/api/quotes/ficha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || "No se pudo generar el PDF");
      }

      const blob = await response.blob();
      if (localPdfUrl) URL.revokeObjectURL(localPdfUrl);
      const nextLocalPdfUrl = URL.createObjectURL(blob);
      setLocalPdfUrl(nextLocalPdfUrl);

      const file = new File(
        [blob],
        `cotizacion-${selectedDevelopment.slug}-unidad-${formData.unitNumber || "unidad"}.pdf`,
        { type: "application/pdf" }
      );
      const publicPdfUrl = await uploadFile(file, "quotes");
      setPersistedImages(imageUrls);
      const savedQuote = await saveQuote(publicPdfUrl, imageUrls, true);
      markQuotePdfCurrent(savedQuote.payload.pdfUrl || publicPdfUrl);
      setNotice("PDF generado y cotización guardada con todos los datos e imágenes actualizados.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar la cotización");
    } finally {
      setIsGenerating(false);
    }
  };

  const shareQuoteId = currentQuoteId || activeQuoteRef.current?.id || currentSavedQuote?.id || "";
  const shareBaseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://barrerabrokers.com";
  const shareQuoteUrl =
    isPdfCurrent && sharedPdfUrl && shareQuoteId ? `${shareBaseUrl}/cotizaciones/${shareQuoteId}` : "";
  const shareTitle = `Cotización ${selectedDevelopment?.name || "Barrera Brokers"} - Unidad ${
    formData.unitNumber || "unidad"
  }`;
  const shareText = shareQuoteUrl ? `${shareTitle}\n${shareQuoteUrl}` : "";
  const mailSubject = shareTitle;
  const mailBody = shareQuoteUrl
    ? `Hola,\n\nTe comparto la ficha de cotización de ${
        selectedDevelopment?.name || "Barrera Brokers"
      } - Unidad ${formData.unitNumber || "unidad"}.\n\n${shareQuoteUrl}\n\nSaludos.`
    : "";

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-accent-700">
            Herramienta comercial
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink md:text-3xl">
            Cotizaciones
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink/60">
            Armá una ficha PDF de una unidad sin cargarla al inventario del desarrollo.
            Ideal para enviar propuestas puntuales a clientes.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="card p-6 md:p-8">
          <div className="mb-8 rounded-xl border border-ink/12 bg-white/55 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
                  Cotizaciones guardadas
                </p>
                <p className="mt-1 text-sm text-ink/62">
                  Cargá una cotización anterior con cliente, unidad, precio, financiación, descripción, comentarios y características.
                </p>
              </div>
              <button
                type="button"
                onClick={resetQuote}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-ink/18 px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-ink transition-colors hover:bg-ink/5"
              >
                Nueva cotización
              </button>
            </div>

            {savedQuotes.length > 0 ? (
              <div className="mt-4 grid gap-2">
                {savedQuotes.slice(0, 6).map((quote) => {
                  const canViewClient = quote.canViewClient !== false;
                  const canManageQuote = quote.canManage !== false;

                  return (
                    <div
                      key={quote.id}
                      className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                        currentQuoteId === quote.id
                          ? "border-accent bg-accent/10"
                          : "border-ink/10 bg-cream-50 hover:border-ink/25"
                      }`}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          {canViewClient ? (
                            <>
                              <p className="text-sm font-medium text-ink">
                                {quote.clientName || "Sin cliente"}
                              </p>
                              {(quote.clientPhone || quote.clientEmail) && (
                                <p className="mt-1 break-words text-xs text-ink/55">
                                  {quote.clientPhone || ""}
                                  {quote.clientPhone && quote.clientEmail ? " · " : ""}
                                  {quote.clientEmail || ""}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="text-sm font-medium text-ink/55">
                              Cliente reservado al agente propietario
                            </p>
                          )}
                          <p className="mt-2 text-sm font-medium text-ink">
                            {quote.developmentName} · Unidad {quote.unitNumber}
                          </p>
                        </div>
                        {canManageQuote ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => loadQuote(quote, "edit")}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:bg-white"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => duplicateQuote(quote)}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-ink/15 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-ink transition-colors hover:bg-white"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteSavedQuote(quote)}
                              disabled={deletingQuoteId === quote.id}
                              className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-red-200 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-55"
                            >
                              {deletingQuoteId === quote.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                              Eliminar
                            </button>
                          </div>
                        ) : (
                          <p className="rounded-md border border-ink/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-ink/45">
                            Solo lectura
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-dashed border-ink/14 px-4 py-3 text-sm text-ink/55">
                Todavía no hay cotizaciones guardadas.
              </p>
            )}
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Desarrollo">
              <select
                value={formData.developmentId}
                onChange={handleDevelopmentChange}
                className="form-input"
              >
                {developments.map((development) => (
                  <option key={development.id} value={development.id}>
                    {development.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {currentSavedQuote && (
            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-ink">
              Editando cotización guardada: {currentSavedQuote.developmentName} · Unidad{" "}
              {currentSavedQuote.unitNumber}. Los cambios se guardan sobre esta misma cotización.
            </div>
          )}

          <div className="mt-8 border-t border-ink/12 pt-8">
            <h2 className="mb-5 font-display text-3xl font-light tracking-[-0.03em] text-ink">
              Datos del cliente
            </h2>
            <div className="grid gap-5 md:grid-cols-3">
            <Field label="Cliente">
              <input
                value={formData.clientName}
                onChange={update("clientName")}
                className="form-input"
                placeholder="Nombre del cliente"
              />
            </Field>
              <Field label="Teléfono">
                <input
                  value={formData.clientPhone}
                  onChange={update("clientPhone")}
                  className="form-input"
                  placeholder="+54 9 11..."
                />
              </Field>
              <Field label="Mail">
                <input
                  type="email"
                  value={formData.clientEmail}
                  onChange={update("clientEmail")}
                  className="form-input"
                  placeholder="cliente@email.com"
                />
              </Field>
            </div>
          </div>

          <div className="mt-8 border-t border-ink/12 pt-8">
            <h2 className="mb-5 font-display text-3xl font-light tracking-[-0.03em] text-ink">
              Datos de la unidad
            </h2>
            <div className="grid gap-5 md:grid-cols-4">
              <Field label="Unidad *">
                <input value={formData.unitNumber} onChange={update("unitNumber")} className="form-input" placeholder="2H" />
              </Field>
              <Field label="Piso">
                <input value={formData.floor} onChange={update("floor")} className="form-input" placeholder="2" />
              </Field>
              <Field label="Ambientes">
                <input type="number" min="0" value={formData.bedrooms} onChange={update("bedrooms")} className="form-input" />
              </Field>
              <Field label="Baños">
                <input type="number" min="0" value={formData.bathrooms} onChange={update("bathrooms")} className="form-input" />
              </Field>
              <Field label="Sup. cubierta *">
                <input type="number" min="0" step="0.01" value={formData.area} onChange={update("area")} className="form-input" placeholder="25.3" />
              </Field>
              <Field label="Balcón">
                <input type="number" min="0" step="0.01" value={formData.balconyArea} onChange={update("balconyArea")} className="form-input" />
              </Field>
              <Field label="Sup. total">
                <input type="number" min="0" step="0.01" value={formData.totalArea} onChange={update("totalArea")} className="form-input" />
              </Field>
              <Field label="Orientación">
                <select value={formData.orientation} onChange={update("orientation")} className="form-input">
                  <option value="">Seleccionar</option>
                  {ORIENTATIONS.map((orientation) => (
                    <option key={orientation} value={orientation}>
                      {orientation}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-8 border-t border-ink/12 pt-8">
            <h2 className="mb-5 font-display text-3xl font-light tracking-[-0.03em] text-ink">
              Precio y financiación
            </h2>
            <div className="grid gap-5 md:grid-cols-4">
              <Field label="Moneda">
                <select value={formData.currency} onChange={update("currency")} className="form-input">
                  <option value="USD">USD</option>
                  <option value="ARS">ARS</option>
                </select>
              </Field>
              <Field label="Precio final *">
                <input type="number" min="0" step="0.01" value={formData.price} onChange={update("price")} className="form-input" />
              </Field>
              <Field label="Anticipo">
                <input type="number" min="0" step="0.01" value={formData.downPayment} onChange={update("downPayment")} className="form-input" />
              </Field>
              <Field label="Cantidad cuotas">
                <input type="number" min="0" value={formData.installmentCount} onChange={update("installmentCount")} className="form-input" />
              </Field>
              <Field label="Valor cuota">
                <input type="number" min="0" step="0.01" value={formData.installmentValue} onChange={update("installmentValue")} className="form-input" />
              </Field>
              <Field label="Expensas">
                <input type="number" min="0" step="0.01" value={formData.expenses} onChange={update("expenses")} className="form-input" />
              </Field>
              <Field label="Estado">
                <select value={formData.status} onChange={update("status")} className="form-input">
                  <option value="disponible">Disponible</option>
                  <option value="reservada">Reservada</option>
                  <option value="vendida">Vendida</option>
                  <option value="consultar">Consultar</option>
                </select>
              </Field>
            </div>
          </div>

          <div className="mt-8 border-t border-ink/12 pt-8">
            <ImageUploader
              items={items}
              primaryIndex={primaryIndex}
              onChange={handleImagesChange}
              label="Imágenes para la cotización"
              helperText="Subí solo 2 imágenes: la primera es el plano de la planta y la segunda es la ubicación en planta."
              maxSizeMB={10}
              maxItems={QUOTE_MAX_IMAGES}
            />
            {items.length >= QUOTE_MAX_IMAGES && (
              <p className="mt-2 text-xs text-amber-700">
                Ya cargaste las 2 imágenes de esta cotización: plano de planta y ubicación en planta.
              </p>
            )}
            {isUploadingImages && (
              <p className="mt-2 inline-flex items-center gap-2 text-xs text-ink/60">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Guardando imágenes para que no se pierdan...
              </p>
            )}
          </div>

          <div className="mt-8 grid gap-5 border-t border-ink/12 pt-8 md:grid-cols-2">
            <Field label="Descripción">
              <textarea
                value={formData.description}
                onChange={update("description")}
                className="form-input min-h-32"
                placeholder="Detalle comercial de la unidad"
              />
            </Field>
            <Field label="Comentarios para el cliente">
              <textarea
                value={formData.comments}
                onChange={update("comments")}
                className="form-input min-h-32"
                placeholder="Forma de pago, observaciones, condiciones, próximos pasos"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Características">
                <textarea
                  value={formData.features}
                  onChange={update("features")}
                  className="form-input min-h-28"
                  placeholder={"Una característica por línea\nSUM\nPileta\nParrilla"}
                />
              </Field>
            </div>
          </div>
        </div>

        <aside className="card h-fit p-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink/45">
            Salida comercial
          </p>
          <h2 className="mt-2 font-display text-3xl font-light tracking-[-0.03em] text-ink">
            Ficha PDF
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink/62">
            Generá el PDF, se sube automáticamente y queda listo para compartir por
            WhatsApp o mail.
          </p>

          <button
            type="button"
            onClick={handleSaveQuote}
            disabled={isSaving || isGenerating || isUploadingImages}
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-ink/18 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isUploadingImages ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando imágenes...
              </>
            ) : isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {currentQuoteId ? "Guardar cambios" : "Guardar cotización"}
              </>
            )}
          </button>

          <button
            type="button"
            onClick={generatePdf}
            disabled={isGenerating || isUploadingImages}
            className="btn-primary mt-3 w-full disabled:cursor-not-allowed disabled:opacity-55"
          >
            {isUploadingImages ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Guardando imágenes...
              </>
            ) : isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Generar PDF
              </>
            )}
          </button>

          <div className="mt-5 grid gap-2">
            {localPdfUrl && (
              <a
                href={localPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/18 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
              >
                <FileText className="h-4 w-4" />
                Ver PDF
              </a>
            )}
            {shareQuoteUrl && (
              <>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-bone transition-colors hover:bg-ink-600"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <button
                  type="button"
                  onClick={() =>
                    openMailShare(
                      mailSubject,
                      mailBody
                    )
                  }
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink/18 px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-ink/5"
                >
                  <Mail className="h-4 w-4" />
                  Mail
                </button>
              </>
            )}
          </div>

          {shareQuoteUrl && (
            <div className="mt-4 rounded-lg bg-white/60 p-3 text-xs leading-relaxed text-ink/60">
              <p className="font-medium uppercase tracking-[0.14em] text-ink/45">
                Link para compartir con vista previa
              </p>
              <p className="mt-2 break-all">{shareQuoteUrl}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.16em] text-ink/55">
        {label}
      </span>
      {children}
    </label>
  );
}
