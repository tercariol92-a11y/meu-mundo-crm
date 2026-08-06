type Req={method?:string;query?:Record<string,string|string[]|undefined>;headers?:Record<string,string|string[]|undefined>};
type Res={setHeader(name:string,value:string):void;status(code:number):Res;json(value:unknown):unknown;send(value:Buffer):unknown};
export default async function handler(req:Req,res:Res){
  try{
    if(req.method!=='GET')return res.status(405).json({success:false,error:'Método não permitido.'});
    const serviceUrl=process.env.WHATSAPP_SERVICE_URL?.trim();const secret=process.env.WHATSAPP_INTERNAL_SECRET?.trim();
    if(!serviceUrl||!secret)return res.status(503).json({success:false,error:'Serviço WhatsApp não configurado.'});
    const authorization=String(req.headers?.authorization||'');if(!authorization.startsWith('Bearer '))return res.status(401).json({success:false,error:'Token Firebase obrigatório.'});
    const messageId=String(req.query?.messageId||'');const sessionId=String(req.query?.sessionId||'');const storagePath=String(req.query?.storagePath||'');
    const target=new URL(`/api/whatsapp/media/${encodeURIComponent(messageId)}`,new URL(serviceUrl));target.searchParams.set('sessionId',sessionId);target.searchParams.set('storagePath',storagePath);
    const upstream=await fetch(target,{headers:{Authorization:authorization,'X-Internal-Secret':secret}});const buffer=Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type',upstream.headers.get('content-type')||'application/octet-stream');res.setHeader('Cache-Control','private, max-age=3600');return res.status(upstream.status).send(buffer);
  }catch(error){console.error('[WhatsApp Media Proxy Error]',error instanceof Error?error.message:'erro desconhecido');return res.status(500).json({success:false,error:'Falha ao carregar mídia.'})}
}
