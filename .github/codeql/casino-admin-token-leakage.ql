/**
 * @name Casino admin token can reach an output sink
 * @description Finds flows from CASINO_ADMIN_TOKEN to common output, transport, and storage sinks.
 * @kind path-problem
 * @problem.severity error
 * @security-severity 8.1
 * @precision medium
 * @id javascript/casino-admin-token-leak
 * @tags security external/cwe/cwe-200 external/cwe/cwe-522
 */
import javascript

class CasinoAdminTokenSink extends DataFlow::Node {
  CasinoAdminTokenSink() {
    exists(DataFlow::MethodCallNode call |
      (
        call.getMethodName() = "send" or
        call.getMethodName() = "write" or
        call.getMethodName() = "end" or
        call.getMethodName() = "log" or
        call.getMethodName() = "info" or
        call.getMethodName() = "warn" or
        call.getMethodName() = "error" or
        call.getMethodName() = "debug" or
        call.getMethodName() = "setItem" or
        call.getMethodName() = "appendFile" or
        call.getMethodName() = "appendFileSync" or
        call.getMethodName() = "broadcast"
      ) and
      this = call.getAnArgument()
    )
    or
    exists(DataFlow::CallNode call |
      (call.getCalleeName() = "fetch" or call.getCalleeName() = "request") and
      this = call.getAnArgument()
    )
  }
}

module CasinoAdminTokenLeakageConfig implements DataFlow::ConfigSig {
  predicate isSource(DataFlow::Node source) {
    source = DataFlow::globalVarRef("process").getAPropertyRead("env").getAPropertyRead("CASINO_ADMIN_TOKEN")
  }

  predicate isSink(DataFlow::Node sink) {
    sink instanceof CasinoAdminTokenSink
  }
}

module CasinoAdminTokenLeakageFlow = TaintTracking::Global<CasinoAdminTokenLeakageConfig>;

import CasinoAdminTokenLeakageFlow::PathGraph

from CasinoAdminTokenLeakageFlow::PathNode source, CasinoAdminTokenLeakageFlow::PathNode sink
where CasinoAdminTokenLeakageFlow::flowPath(source, sink)
select sink.getNode(), source, sink, "CASINO_ADMIN_TOKEN flows to an output sink from $@.", source, "the environment variable"
