import { ArcaError } from "@/lib/fiscal/arca/arca-errors";
import { extractSoapFault } from "@/lib/fiscal/arca/arca-xml";

export async function sendSoapRequest(input: {
  endpoint: string;
  soapAction: string;
  body: string;
  includeRawResponseInError?: boolean;
}) {
  const response = await fetch(input.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: input.soapAction
    },
    body: input.body,
    cache: "no-store"
  });

  const text = await response.text();
  const fault = extractSoapFault(text);

  if (!response.ok || fault) {
    const detail = input.includeRawResponseInError
      ? [
          fault ? `SOAP fault: ${fault}` : `HTTP ${response.status}`,
          "Raw SOAP:",
          text.slice(0, 4000)
        ].join("\n")
      : fault ?? `HTTP ${response.status}: ${text.slice(0, 1000)}`;

    throw new ArcaError(
      fault ? "ARCA rechazo la solicitud." : "No se pudo consultar ARCA.",
      detail
    );
  }

  return text;
}
